"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FileText, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckboxRow, SelectField, TextField, TextareaField } from "@/components/ui/Field";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { BANK } from "@/config/site";
import { clearCart, useCart } from "@/features/cart/store";
import { DELIVERY_STATES } from "@/lib/delivery";
import { formatNaira } from "@/lib/money";
import { computeTotals } from "@/lib/pricing";
import { readStorage, writeStorage } from "@/lib/storage";
import { MAX_RECEIPT_BYTES, receiptProblem } from "@/schemas/checkout";
import { placeOrder } from "@/server/actions/orders";
import { CopyButton } from "./CopyButton";
import { resetCheckoutChoices, setCheckoutChoices, useCheckoutChoices } from "./session";
import {
  EMPTY_VALUES,
  validateContact,
  validateDelivery,
  type CheckoutValues,
  type Errors,
} from "./validate";

const FORM_KEY = "LBS_CHECKOUT_FORM";
type StepId = 0 | 1 | 2;

function loadValues(raw: string | null): CheckoutValues {
  if (!raw) return EMPTY_VALUES;
  try {
    return { ...EMPTY_VALUES, ...(JSON.parse(raw) as Partial<CheckoutValues>) };
  } catch {
    return EMPTY_VALUES;
  }
}

const noopSubscribe = () => () => {};
const readSaved = () => readStorage(FORM_KEY);

/** Reads the saved form once the page is on the device, then hands it to the form as its starting state. */
export function CheckoutView() {
  const saved = useSyncExternalStore(noopSubscribe, readSaved, () => undefined);
  const choices = useCheckoutChoices();
  if (saved === undefined)
    return <div className="mx-auto min-h-[60dvh] max-w-[560px] px-4 pt-10" aria-busy="true" />;
  return <CheckoutForm initial={parseSaved(saved, choices.state)} />;
}

function parseSaved(raw: string | null, stateFromBag: string): CheckoutValues {
  const saved = loadValues(raw);
  return { ...saved, state: stateFromBag || saved.state };
}

function CheckoutForm({ initial }: { readonly initial: CheckoutValues }) {
  const router = useRouter();
  const lines = useCart();
  const choices = useCheckoutChoices();
  const [values, setValues] = useState<CheckoutValues>(initial);
  const [step, setStep] = useState<StepId>(0);
  const [touched, setTouched] = useState<Partial<Record<keyof CheckoutValues, boolean>>>({});
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState<string | undefined>();
  const [confirmed, setConfirmed] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    writeStorage(FORM_KEY, JSON.stringify(values));
  }, [values]);

  const totals = useMemo(
    () =>
      computeTotals(lines, { promoPercent: choices.promo?.percent ?? 0, stateId: values.state }),
    [lines, choices.promo, values.state],
  );

  const contactErrors = validateContact(values);
  const deliveryErrors = validateDelivery(values);
  const errorsFor = (errors: Errors): Errors => {
    const visible: Errors = {};
    for (const key of Object.keys(errors) as (keyof CheckoutValues)[]) {
      const message = errors[key];
      if (touched[key] && message) visible[key] = message;
    }
    return visible;
  };
  const shown = errorsFor({ ...contactErrors, ...deliveryErrors });

  function set<K extends keyof CheckoutValues>(key: K, value: CheckoutValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (key === "state") setCheckoutChoices({ state: value });
  }
  const blur = (key: keyof CheckoutValues) => () => setTouched((t) => ({ ...t, [key]: true }));

  function focusFirstInvalid(errors: Errors) {
    const first = Object.keys(errors)[0];
    if (first) form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }

  function next() {
    const errors = step === 0 ? contactErrors : deliveryErrors;
    if (Object.keys(errors).length > 0) {
      setTouched((t) => ({
        ...t,
        ...Object.fromEntries(Object.keys(errors).map((k) => [k, true])),
      }));
      focusFirstInvalid(errors);
      return;
    }
    setStep((s) => (s === 0 ? 1 : 2));
  }

  function chooseReceipt(file: File | undefined) {
    if (!file) return;
    const problem = receiptProblem(file);
    setReceiptError(problem ?? undefined);
    setReceipt(problem ? null : file);
  }

  const missing =
    receipt === null
      ? "Attach your payment receipt."
      : !confirmed
        ? "Tick the box to confirm you have sent the payment."
        : null;

  function submit() {
    if (submitting.current || missing) return;
    submitting.current = true;
    setServerError(undefined);
    const data = new FormData();
    data.set(
      "payload",
      JSON.stringify({
        contact: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
        },
        delivery: {
          address: values.address,
          city: values.city,
          state: values.state,
          landmark: values.landmark || undefined,
          notes: values.notes || undefined,
        },
        lines: lines.map((l) => ({
          id: l.id,
          selectedSize: l.selectedSize,
          selectedColor: l.selectedColor,
          qty: l.qty,
        })),
        promoCode: choices.promo?.code,
        confirmedTransfer: confirmed,
      }),
    );
    if (receipt) data.set("receipt", receipt);
    startTransition(async () => {
      try {
        const result = await placeOrder(data);
        if (result.ok) {
          clearCart();
          resetCheckoutChoices();
          setTouched({});
          writeStorage(
            FORM_KEY,
            JSON.stringify({
              ...EMPTY_VALUES,
              firstName: values.firstName,
              lastName: values.lastName,
              email: values.email,
              phone: values.phone,
            }),
          );
          router.push("/confirmation");
          return;
        }
        setServerError(result.message);
      } catch {
        setServerError(
          "We could not place your order. Your bag is unchanged. Check your connection and try again.",
        );
      } finally {
        submitting.current = false;
      }
    });
  }

  if (lines.length === 0 && !pending) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl">Your bag is empty</h1>
        <p className="mt-3 text-base text-muted">Add something to your bag before checking out.</p>
        <ButtonLink href="/shop" className="mt-8">
          Browse the shop
        </ButtonLink>
      </div>
    );
  }

  const label =
    step === 0
      ? "Continue to delivery"
      : step === 1
        ? "Continue to payment"
        : `Place order · ${formatNaira(totals.total)}`;
  const onPrimary = step === 2 ? submit : next;
  const primaryDisabled = pending || (step === 2 && missing !== null);

  const summaryRow = (title: string, text: string, to: StepId) => (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium">
          <Check size={16} strokeWidth={1.5} className="text-success" aria-hidden="true" />
          {title}
        </p>
        <p className="mt-0.5 text-base break-words text-muted">{text}</p>
      </div>
      <button
        type="button"
        className="min-h-11 min-w-11 shrink-0 text-base text-primary underline underline-offset-4"
        onClick={() => setStep(to)}
      >
        Edit
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-[560px] px-4 pt-4 pb-[calc(var(--bar-h)+var(--safe-bottom)+1rem)] sm:pt-10 sm:pb-16">
      <h1 className="font-display text-[2rem] leading-tight md:text-4xl">Checkout</h1>

      <details className="mt-4 border border-line bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-base [&::-webkit-details-marker]:hidden">
          <span>{lines.reduce((n, l) => n + l.qty, 0)} items</span>
          <span className="tabular font-semibold">{formatNaira(totals.total)}</span>
        </summary>
        <div className="border-t border-line px-4 py-3 text-base">
          <ul className="divide-y divide-line">
            {lines.map((l) => (
              <li key={l.variantId} className="flex justify-between gap-3 py-2">
                <span className="min-w-0">
                  {l.name}
                  <span className="block text-sm text-subtle">
                    {[l.selectedSize, l.selectedColor].filter(Boolean).join(" · ")} × {l.qty}
                  </span>
                </span>
                <span className="tabular">{formatNaira(l.price_ngn * l.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular">{formatNaira(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">Discount</dt>
                <dd className="tabular">−{formatNaira(totals.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd className="tabular">
                {values.state
                  ? totals.delivery === 0
                    ? "Free"
                    : formatNaira(totals.delivery)
                  : "Choose a state"}
              </dd>
            </div>
            <div className="flex justify-between pt-1 font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatNaira(totals.total)}</dd>
            </div>
          </dl>
          <Link href="/cart" className="mt-3 inline-flex min-h-11 items-center">
            Change your bag
          </Link>
        </div>
      </details>

      <form
        ref={form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onPrimary();
        }}
        className="mt-6 flex flex-col gap-8"
      >
        <section aria-labelledby="step-contact">
          <h2 id="step-contact" className="font-sans text-lg font-semibold">
            1. Contact
          </h2>
          {step === 0 ? (
            <div className="mt-3 flex flex-col gap-4">
              <TextField
                label="First name"
                name="firstName"
                autoComplete="given-name"
                autoCapitalize="words"
                enterKeyHint="next"
                value={values.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                onBlur={blur("firstName")}
                error={shown.firstName}
              />
              <TextField
                label="Last name"
                name="lastName"
                autoComplete="family-name"
                autoCapitalize="words"
                enterKeyHint="next"
                value={values.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                onBlur={blur("lastName")}
                error={shown.lastName}
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
                onBlur={blur("email")}
                error={shown.email}
              />
              <TextField
                label="Phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="done"
                hint="For delivery updates. 08012345678 or +2348012345678."
                value={values.phone}
                onChange={(e) => set("phone", e.target.value)}
                onBlur={blur("phone")}
                error={shown.phone}
              />
            </div>
          ) : (
            <div className="mt-3">
              {summaryRow(
                `${values.firstName} ${values.lastName}`,
                `${values.email} · ${values.phone}`,
                0,
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="step-delivery">
          <h2
            id="step-delivery"
            className={`font-sans text-lg font-semibold ${step < 1 ? "text-subtle" : ""}`}
          >
            2. Delivery
          </h2>
          {step === 1 ? (
            <div className="mt-3 flex flex-col gap-4">
              <TextField
                label="Address"
                name="address"
                autoComplete="shipping address-line1"
                enterKeyHint="next"
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
                onBlur={blur("address")}
                error={shown.address}
              />
              <TextField
                label="City or town"
                name="city"
                autoComplete="shipping address-level2"
                autoCapitalize="words"
                enterKeyHint="next"
                value={values.city}
                onChange={(e) => set("city", e.target.value)}
                onBlur={blur("city")}
                error={shown.city}
              />
              <SelectField
                label="State"
                name="state"
                autoComplete="shipping address-level1"
                value={values.state}
                onChange={(e) => set("state", e.target.value)}
                onBlur={blur("state")}
                error={shown.state}
              >
                <option value="">Choose a state</option>
                {DELIVERY_STATES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} · {s.feeNgn === 0 ? "Free" : formatNaira(s.feeNgn)}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Landmark"
                name="landmark"
                optional
                autoComplete="off"
                enterKeyHint="next"
                value={values.landmark}
                onChange={(e) => set("landmark", e.target.value)}
              />
              <TextareaField
                label="Order notes"
                name="notes"
                optional
                autoComplete="off"
                maxLength={500}
                enterKeyHint="done"
                hint={`${values.notes.length} of 500 characters`}
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
                error={shown.notes}
              />
            </div>
          ) : step > 1 ? (
            <div className="mt-3">
              {summaryRow(
                `${values.address}, ${values.city}`,
                `${DELIVERY_STATES.find((s) => s.id === values.state)?.label ?? values.state}${totals.delivery === 0 ? " · Free delivery" : ` · Delivery ${formatNaira(totals.delivery)}`}`,
                1,
              )}
            </div>
          ) : null}
        </section>

        <section aria-labelledby="step-payment">
          <h2
            id="step-payment"
            className={`font-sans text-lg font-semibold ${step < 2 ? "text-subtle" : ""}`}
          >
            3. Payment
          </h2>
          {step === 2 ? (
            <div className="mt-3 flex flex-col gap-5">
              <fieldset>
                <legend className="sr-only">Payment method</legend>
                <label className="flex min-h-14 items-center gap-3 border border-primary bg-primary-tint px-3 text-base">
                  <input
                    type="radio"
                    name="method"
                    defaultChecked
                    className="size-5 accent-[var(--c-primary)]"
                  />
                  Bank transfer
                </label>
                <label className="mt-2 flex min-h-14 items-center gap-3 border border-line px-3 text-base text-subtle">
                  <input type="radio" name="method" disabled className="size-5" />
                  Pay with card <span className="ml-auto text-sm">Not available yet</span>
                </label>
              </fieldset>

              <ol className="space-y-5 text-base">
                <li>
                  <p className="font-medium">
                    1. Send {formatNaira(totals.total)} from your banking app
                  </p>
                  <dl className="mt-2 border border-line bg-surface px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted">Bank</dt>
                      <dd>{BANK.bankName}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted">Account number</dt>
                      <dd className="tabular flex items-center">
                        {BANK.accountNumber}
                        <CopyButton value={BANK.accountNumber} label="account number" />
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-2 py-1">
                      <dt className="shrink-0 text-muted">Account name</dt>
                      <dd className="text-right">{BANK.accountName}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted">Amount</dt>
                      <dd className="tabular flex items-center">
                        {formatNaira(totals.total)}
                        <CopyButton value={String(totals.total)} label="amount" />
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-sm text-subtle">
                    You can leave this page to pay. Your bag and the details you have entered will
                    be here when you return.
                  </p>
                </li>
                <li>
                  <p className="font-medium">2. Attach your receipt</p>
                  <input
                    id="receipt"
                    name="receipt"
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    aria-describedby="receipt-hint receipt-error"
                    onChange={(e) => chooseReceipt(e.target.files?.[0])}
                  />
                  {receipt ? (
                    <p className="mt-2 flex min-h-12 items-center justify-between gap-2 border border-line bg-surface px-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText size={18} strokeWidth={1.5} aria-hidden="true" />
                        <span className="truncate">{receipt.name}</span>
                      </span>
                      <button
                        type="button"
                        aria-label="Remove receipt"
                        className="flex size-11 shrink-0 items-center justify-center"
                        onClick={() => {
                          setReceipt(null);
                          const input = form.current?.querySelector<HTMLInputElement>("#receipt");
                          if (input) input.value = "";
                        }}
                      >
                        <X size={18} strokeWidth={1.5} />
                      </button>
                    </p>
                  ) : (
                    <label
                      htmlFor="receipt"
                      className="mt-2 flex min-h-12 cursor-pointer items-center justify-center border border-dashed border-control bg-surface px-3 text-base text-primary"
                    >
                      Choose a photograph or PDF
                    </label>
                  )}
                  <p id="receipt-hint" className="mt-1 text-sm text-subtle">
                    JPG, PNG, WebP or PDF, up to {MAX_RECEIPT_BYTES / 1024 / 1024} MB.
                  </p>
                  <p id="receipt-error" className="text-sm font-medium text-error">
                    {receiptError}
                  </p>
                </li>
                <li>
                  <p className="font-medium">3. Confirm</p>
                  <CheckboxRow
                    label="I have sent the payment"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <p className="text-sm text-subtle">
                    A person checks your payment against your receipt, then confirms your order by
                    email.
                  </p>
                </li>
              </ol>
            </div>
          ) : null}
        </section>

        {serverError ? (
          <p
            role="alert"
            className="border-l-4 border-error bg-error-bg px-4 py-3 text-base text-error"
          >
            {serverError}
          </p>
        ) : null}

        <div className="hidden flex-col gap-2 sm:flex">
          {step === 2 && missing ? <p className="text-sm text-subtle">{missing}</p> : null}
          <div className="flex justify-between">
            {step > 0 ? (
              <Button variant="secondary" onClick={() => setStep((s) => (s === 2 ? 1 : 0))}>
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={primaryDisabled}>
              {pending ? "Placing order…" : label}
            </Button>
          </div>
        </div>
      </form>

      <StickyActionBar>
        {step === 2 && missing ? <p className="mb-2 text-sm text-subtle">{missing}</p> : null}
        <div className="flex gap-3">
          {step > 0 ? (
            <Button variant="secondary" onClick={() => setStep((s) => (s === 2 ? 1 : 0))}>
              Back
            </Button>
          ) : null}
          <Button className="flex-1" disabled={primaryDisabled} onClick={onPrimary}>
            {pending ? "Placing order…" : label}
          </Button>
        </div>
      </StickyActionBar>
    </div>
  );
}
