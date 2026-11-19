"use client";

import { countOf } from "@/lib/plural";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FileText, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckboxRow, SelectField, TextField, TextareaField } from "@/components/ui/Field";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { clearCart, useCart } from "@/features/cart/store";
import { DELIVERY_STATES } from "@/lib/delivery";
import { PAYMENT_DETAILS_UPDATING } from "@/lib/bank-details";
import { formatNaira } from "@/lib/money";
import { computeTotals } from "@/lib/pricing";
import { readStorage, writeStorage } from "@/lib/storage";
import { prepareReceipt } from "@/lib/compress-image";
import {
  MAX_RECEIPT_BYTES,
  MAX_RECEIPT_MB,
  RECEIPT_ACCEPT,
  receiptProblem,
} from "@/lib/receipt-types";
import { getQuote, placeOrder, type QuoteState } from "@/server/actions/orders";
import { CopyButton } from "./CopyButton";
import { uploadReceiptFor } from "./upload-receipt";
import { resetCheckoutChoices, setCheckoutChoices, useCheckoutChoices } from "./session";
import {
  EMPTY_VALUES,
  validateContact,
  validateDelivery,
  type CheckoutValues,
  type Errors,
} from "./validate";

const FORM_KEY = "LBS_CHECKOUT_FORM";
const KEY_KEY = "LBS_CHECKOUT_ATTEMPT";

/** One key per checkout attempt, kept across reloads until the order is placed, so a retry never places twice. */
function attemptKey(): string {
  const saved = readStorage(KEY_KEY);
  if (saved && /^[A-Za-z0-9-]{16,64}$/.test(saved)) return saved;
  const fresh = crypto.randomUUID();
  writeStorage(KEY_KEY, fresh);
  return fresh;
}
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

/** The signed-in customer's details, from their account (null for a guest). */
export type CheckoutAccount = Pick<
  CheckoutValues,
  "email" | "firstName" | "lastName" | "phone" | "address" | "city" | "state"
>;

/** Reads the saved form once the page is on the device, then hands it to the form as its starting state. */
export function CheckoutView({ account = null }: { readonly account?: CheckoutAccount | null }) {
  const saved = useSyncExternalStore(noopSubscribe, readSaved, () => undefined);
  const choices = useCheckoutChoices();
  if (saved === undefined) {
    return (
      <div className="mx-auto min-h-[60dvh] max-w-[560px] px-4 pt-4 sm:pt-10" aria-busy="true">
        <h1 className="font-display text-[2rem] leading-tight md:text-4xl">Checkout</h1>
        <p className="mt-2 max-w-[34rem] text-lg text-muted">
          Pay by bank transfer, then upload your receipt. Your details are kept on this phone until
          the order is placed.
        </p>
      </div>
    );
  }
  return <CheckoutForm initial={parseSaved(saved, choices.state, account)} />;
}

function parseSaved(
  raw: string | null,
  stateFromBag: string,
  account: CheckoutAccount | null,
): CheckoutValues {
  const saved = loadValues(raw);
  if (!account) return { ...saved, state: stateFromBag || saved.state };
  // The account's details win over anything an earlier guest order left in this browser; the saved
  // form only fills what the account does not have.
  const fill = (fromAccount: string, fromBrowser: string) => fromAccount || fromBrowser;
  return {
    ...saved,
    email: account.email,
    firstName: fill(account.firstName, saved.firstName),
    lastName: fill(account.lastName, saved.lastName),
    phone: fill(account.phone, saved.phone),
    address: fill(account.address, saved.address),
    city: fill(account.city, saved.city),
    state: stateFromBag || fill(account.state, saved.state),
  };
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
  const [preparing, setPreparing] = useState(false);
  const [quoted, setQuoted] = useState<{ key: string; result: QuoteState } | null>(null);
  const [quoteTick, setQuoteTick] = useState(0);
  const [idempotencyKey] = useState(attemptKey);
  const uploaded = useRef<{ file: File; path: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    writeStorage(FORM_KEY, JSON.stringify(values));
  }, [values]);

  const promoCode = choices.promo?.code;
  const request = useMemo(
    () => ({
      lines: lines.map((l) => ({
        id: l.id,
        selectedSize: l.selectedSize,
        selectedColor: l.selectedColor,
        qty: l.qty,
      })),
      promoCode,
      state: values.state,
    }),
    [lines, promoCode, values.state],
  );
  const quoteKey = JSON.stringify([request, quoteTick]);
  const quote: QuoteState | "loading" =
    quoted && quoted.key === quoteKey ? quoted.result : "loading";
  const bagIsEmpty = lines.length === 0;
  useEffect(() => {
    if (step !== 2 || bagIsEmpty) return;
    let current = true;
    const key = JSON.stringify([request, quoteTick]);
    getQuote(request)
      .then((result) => {
        if (current) setQuoted({ key, result });
      })
      .catch(() => {
        if (current)
          setQuoted({
            key,
            result: {
              ok: false,
              message:
                "We could not work out the amount to transfer. Check your connection and try again.",
            },
          });
      });
    return () => {
      current = false;
    };
  }, [step, bagIsEmpty, request, quoteTick]);

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

  async function chooseReceipt(file: File | undefined) {
    if (!file) return;
    setReceiptError(undefined);
    setPreparing(true);
    const prepared = await prepareReceipt(file, MAX_RECEIPT_BYTES);
    setPreparing(false);
    if (!prepared.ok) {
      setReceipt(null);
      setReceiptError(prepared.message);
      return;
    }
    const problem = receiptProblem(prepared.file);
    setReceiptError(problem ?? undefined);
    setReceipt(problem ? null : prepared.file);
    uploaded.current = null;
  }

  const missing =
    quote === "loading"
      ? "Working out the amount to transfer."
      : !quote.ok
        ? "The amount could not be worked out."
        : !quote.bank
          ? `${PAYMENT_DETAILS_UPDATING}.`
          : preparing
            ? "Getting your receipt ready."
            : receipt === null
              ? "Attach your payment receipt."
              : !confirmed
                ? "Tick the box to confirm you have sent the payment."
                : null;

  function submit() {
    if (submitting.current || missing || quote === "loading" || !quote.ok || !receipt) return;
    submitting.current = true;
    setServerError(undefined);
    const file = receipt;
    const quotedTotal = quote.total;
    startTransition(async () => {
      try {
        let path = uploaded.current?.file === file ? uploaded.current.path : null;
        if (!path) {
          // The server trims and shortens these details to fit; it never refuses an upload for them.
          const sent = await uploadReceiptFor(idempotencyKey, file, undefined, {
            contact: {
              name: `${values.firstName} ${values.lastName}`.trim(),
              email: values.email,
              phone: values.phone,
            },
            quotedTotal,
          });
          if (!sent.ok) {
            setServerError(sent.message);
            return;
          }
          path = sent.path;
          uploaded.current = { file, path };
        }
        const result = await placeOrder({
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
          promoCode,
          confirmedTransfer: confirmed,
          quotedTotal,
          idempotencyKey,
          receiptPath: path,
        });
        if (result.ok) {
          clearCart();
          resetCheckoutChoices();
          setTouched({});
          writeStorage(KEY_KEY, "");
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
        if (result.changedTotal !== undefined) {
          // The amount moved since it was shown: show the new one and ask for a fresh confirmation.
          setConfirmed(false);
          setQuoteTick((n) => n + 1);
        }
        setServerError(result.message);
      } catch {
        setServerError(
          "We could not confirm your order. If you have already made the transfer, please do not pay again: we have your receipt, and if the order cannot be completed we will contact you and refund you in full. Check your connection and try again.",
        );
      } finally {
        submitting.current = false;
      }
    });
  }

  if (lines.length === 0 && !pending) {
    return (
      <div className="mx-auto max-w-[560px] px-4 pt-4 sm:pt-10">
        <h1 className="font-display text-[2rem] leading-tight md:text-4xl">Checkout</h1>
        <p className="mt-2 max-w-[34rem] text-lg text-muted">
          Pay by bank transfer, then upload your receipt. Your details are kept on this phone until
          the order is placed.
        </p>
        <h2 className="mt-12 font-display text-3xl">Your bag is empty</h2>
        <p className="mt-3 text-base text-muted">Add something to your bag before checking out.</p>
        <div className="mt-8 flex justify-end">
          <ButtonLink href="/shop">Browse the shop</ButtonLink>
        </div>
      </div>
    );
  }

  const label =
    step === 0
      ? "Continue to delivery"
      : step === 1
        ? "Continue to payment"
        : `Place order · ${formatNaira(quote !== "loading" && quote.ok ? quote.total : totals.total)}`;
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
      <p className="mt-2 max-w-[34rem] text-lg text-muted">
        Pay by bank transfer, then upload your receipt. Your details are kept on this phone until
        the order is placed.
      </p>

      <details className="mt-4 border border-line bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-base [&::-webkit-details-marker]:hidden">
          <span>
            {countOf(
              lines.reduce((n, l) => n + l.qty, 0),
              "item",
            )}
          </span>
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
                  {quote === "loading" ? (
                    <p className="font-medium" role="status">
                      Working out the amount to transfer…
                    </p>
                  ) : !quote.ok ? (
                    <div role="alert">
                      <p className="border-l-4 border-error bg-error-bg px-4 py-3 text-base text-error">
                        {quote.message}
                      </p>
                      <div className="mt-3 flex justify-end">
                        <Button variant="secondary" onClick={() => setQuoteTick((n) => n + 1)}>
                          Try again
                        </Button>
                      </div>
                    </div>
                  ) : !quote.bank ? (
                    <p
                      role="status"
                      className="border-l-4 border-warning bg-warning-bg px-4 py-3 text-base"
                    >
                      {PAYMENT_DETAILS_UPDATING}. Please try again a little later, or message us on
                      WhatsApp.
                    </p>
                  ) : (
                    <>
                      <p className="font-medium">
                        1. Send {formatNaira(quote.total)} from your banking app
                      </p>
                      <dl className="mt-2 border border-line bg-surface px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted">Bank</dt>
                          <dd>{quote.bank.bankName}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted">Account number</dt>
                          <dd className="tabular flex items-center">
                            {quote.bank.accountNumber}
                            <CopyButton value={quote.bank.accountNumber} label="account number" />
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-2 py-1">
                          <dt className="shrink-0 text-muted">Account name</dt>
                          <dd className="text-right">{quote.bank.accountName}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted">Amount</dt>
                          <dd className="tabular flex items-center">
                            {formatNaira(quote.total)}
                            <CopyButton value={String(quote.total)} label="amount" />
                          </dd>
                        </div>
                      </dl>
                      {quote.bank.note ? <p className="mt-2 text-base">{quote.bank.note}</p> : null}
                      <p className="mt-2 text-sm text-subtle">
                        You can leave this page to pay. Your bag and the details you have entered
                        will be here when you return.
                      </p>
                    </>
                  )}
                </li>
                <li>
                  <p className="font-medium">2. Attach your receipt</p>
                  <input
                    id="receipt"
                    name="receipt"
                    type="file"
                    accept={RECEIPT_ACCEPT}
                    className="sr-only"
                    aria-describedby="receipt-hint receipt-error"
                    onChange={(e) => void chooseReceipt(e.target.files?.[0])}
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
                    Photographs are shrunk for you. JPG, PNG, WebP or PDF, up to {MAX_RECEIPT_MB}{" "}
                    MB.
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
              {pending ? "Placing order…" : preparing ? "Preparing receipt…" : label}
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
            {pending ? "Placing order…" : preparing ? "Preparing receipt…" : label}
          </Button>
        </div>
      </StickyActionBar>
    </div>
  );
}
