"use client";

import { ArrowDown, ArrowUp, Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonRow, IconButton } from "@/components/ui/Button";
import { CheckboxRow, SelectField, TextareaField, TextField } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { compressImage } from "@/lib/compress-image";
import { swatchFor } from "@/lib/colours";
import { formatNaira } from "@/lib/money";
import { fieldErrors } from "@/schemas/auth";
import { CATEGORIES, GENDERS, PACK_TYPES, SIZE_CHOICES, productDraftSchema } from "@/schemas/admin";
import {
  restoreProductsAction,
  saveProductAction,
  trashProductsAction,
} from "@/server/actions/admin";
import {
  groupBySize,
  removeVariant,
  totalUnits,
  upsertVariant,
  type VariantRow,
} from "@/lib/variants";
import { ConfirmButton } from "./ConfirmButton";
import { useAdminAction } from "./useAdminAction";

export interface EditorInitial {
  readonly name: string;
  readonly category: string;
  readonly gender: string;
  readonly price: string;
  readonly description: string;
  readonly deliveryType: "standard" | "express";
  readonly isNew: boolean;
  readonly active: boolean;
  readonly allowColourSelection: boolean;
  readonly packType: string;
  readonly variants: readonly VariantRow[];
  readonly images: readonly { src: string; alt: string }[];
}

const STEPS = ["Details", "Stock", "Photos", "Review"] as const;
const STEP_FIELDS: readonly (readonly string[])[] = [
  ["name", "category", "gender", "priceNgn", "description"],
  ["variants", "packType"],
  ["images"],
  [],
];
const COLOUR_SUGGESTIONS = [
  "Black",
  "White",
  "Nude",
  "Wine",
  "Champagne",
  "Navy",
  "Pink",
  "Red",
  "Ivory",
  "Grey",
  "Beige",
  "Brown",
  "Green",
  "Blue",
  "Charcoal",
];
const QUICK_SIZES = ["S", "M", "L", "XL"];

export function ProductEditor({
  id,
  initial,
  stockVersion,
}: {
  readonly id: string | null;
  readonly initial: EditorInitial;
  readonly stockVersion?: number | undefined;
}) {
  const router = useRouter();
  const toast = useToast();
  const { run, pending } = useAdminAction();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [entry, setEntry] = useState({ size: "", color: "", qty: "" });
  const [entryError, setEntryError] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof EditorInitial>(key: K, value: EditorInitial[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function draft() {
    const colourless = !form.allowColourSelection;
    return {
      name: form.name,
      category: form.category,
      gender: form.gender,
      priceNgn: form.price.trim() === "" ? undefined : Number(form.price.replace(/[,\s]/g, "")),
      description: form.description,
      deliveryType: form.deliveryType,
      isNew: form.isNew,
      active: form.active,
      allowColourSelection: form.allowColourSelection,
      packType: colourless ? form.packType || "2-in-1" : "Single",
      variants: form.variants.map((v) => ({ ...v, color: colourless ? "" : v.color })),
      images: form.images,
      stockVersion,
    };
  }

  function check(fields: readonly string[]): boolean {
    const parsed = productDraftSchema.safeParse(draft());
    const found = parsed.success ? {} : fieldErrors(parsed.error);
    const relevant = Object.fromEntries(
      Object.entries(found).filter(([key]) => fields.includes(key.split(".")[0] ?? key)),
    );
    setErrors(relevant);
    return Object.keys(relevant).length === 0;
  }

  function next() {
    if (check(STEP_FIELDS[step] ?? [])) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function save() {
    const parsed = productDraftSchema.safeParse(draft());
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      setErrors(found);
      const first = STEP_FIELDS.findIndex((fields) =>
        Object.keys(found).some((k) => fields.includes(k.split(".")[0] ?? k)),
      );
      if (first >= 0) setStep(first);
      toast.show("Please check the highlighted details.", { tone: "error" });
      return;
    }
    setSaving(true);
    const result = await saveProductAction(id, draft());
    setSaving(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.show(result.message, { tone: "error" });
      return;
    }
    toast.show(result.message ?? "Saved.", { tone: "success" });
    router.push("/admin/products");
    router.refresh();
  }

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function addVariant() {
    const qty = Number(entry.qty === "" ? "0" : entry.qty);
    if (entry.size.trim() === "") return setEntryError("Choose or type a size.");
    if (!Number.isInteger(qty) || qty < 0)
      return setEntryError("Stock must be a whole number, zero or more.");
    if (form.allowColourSelection && entry.color.trim() === "")
      return setEntryError("Enter a colour, or switch to an assorted pack.");
    setEntryError(undefined);
    set(
      "variants",
      upsertVariant(form.variants, {
        size: entry.size,
        color: form.allowColourSelection ? entry.color : "",
        qty,
      }),
    );
    setEntry((e) => ({ ...e, qty: "" }));
  }

  function bump(row: VariantRow, by: number) {
    set("variants", upsertVariant(form.variants, { ...row, qty: Math.max(0, row.qty + by) }));
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const added: { src: string; alt: string }[] = [];
    for (const original of Array.from(files)) {
      if (form.images.length + added.length >= 8) {
        toast.show("Use at most eight photographs.", { tone: "warning" });
        break;
      }
      const file = await compressImage(original);
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/admin/api/upload", { method: "POST", body });
      const json = (await response.json()) as {
        ok: boolean;
        message?: string;
        image?: { src: string };
      };
      if (json.ok && json.image) added.push({ src: json.image.src, alt: "" });
      else toast.show(json.message ?? "A photograph could not be uploaded.", { tone: "error" });
    }
    setForm((f) => ({ ...f, images: [...f.images, ...added] }));
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  function moveImage(index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= form.images.length) return;
    const copy = [...form.images];
    const [item] = copy.splice(index, 1);
    if (item) copy.splice(to, 0, item);
    set("images", copy);
  }

  const groups = groupBySize(form.variants);
  const units = totalUnits(form.variants);
  const last = step === STEPS.length - 1;

  return (
    <Form onSubmit={(e) => e.preventDefault()} aria-label={id ? "Edit product" : "Add product"}>
      <div className="mb-5 overflow-x-auto">
        <Stepper steps={STEPS} current={step} />
      </div>

      {Object.keys(errors).length > 0 ? (
        <p role="alert" className="mb-4 border-l-4 border-error bg-error-bg p-3 text-base">
          Please check the highlighted details.
        </p>
      ) : null}

      {step === 0 ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="sr-only">Details</legend>
          <TextField
            label="Name"
            name="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
            autoComplete="off"
            enterKeyHint="next"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Category"
              name="category"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              error={errors.category}
            >
              <option value="">Choose</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectField>
            <SelectField
              label="For"
              name="gender"
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
              error={errors.gender}
            >
              <option value="">Choose</option>
              {GENDERS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </SelectField>
          </div>
          <TextField
            label="Price in naira"
            name="price"
            inputMode="numeric"
            autoComplete="off"
            value={form.price}
            onChange={(e) => set("price", e.target.value.replace(/[^\d]/g, ""))}
            error={errors.priceNgn}
            hint="Whole naira, for example 18500."
          />
          <TextareaField
            label="Description"
            name="description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            error={errors.description}
            optional
          />
          <SelectField
            label="Delivery"
            name="deliveryType"
            value={form.deliveryType}
            onChange={(e) =>
              set("deliveryType", e.target.value === "express" ? "express" : "standard")
            }
          >
            <option value="standard">Standard</option>
            <option value="express">Same day</option>
          </SelectField>
          <div>
            <CheckboxRow
              label="Show in the shop"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
            />
            <CheckboxRow
              label="Mark as a new arrival"
              checked={form.isNew}
              onChange={(e) => set("isNew", e.target.checked)}
            />
          </div>
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className="flex flex-col gap-5">
          <legend className="sr-only">Stock</legend>
          <div
            role="radiogroup"
            aria-label="How colours are sold"
            className="grid grid-cols-2 gap-2"
          >
            {[
              { on: true, label: "Choose a colour", hint: "Customers pick the colour." },
              { on: false, label: "Assorted pack", hint: "Colours are mixed." },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={form.allowColourSelection === o.on}
                onClick={() => set("allowColourSelection", o.on)}
                className={`min-h-16 rounded-sm border p-3 text-left ${form.allowColourSelection === o.on ? "border-primary bg-selected" : "border-control"}`}
              >
                <span className="block text-base font-medium">{o.label}</span>
                <span className="block text-sm text-muted">{o.hint}</span>
              </button>
            ))}
          </div>
          {!form.allowColourSelection ? (
            <SelectField
              label="Pack"
              name="packType"
              value={form.packType || "2-in-1"}
              onChange={(e) => set("packType", e.target.value)}
              error={errors.packType}
            >
              {PACK_TYPES.filter((p) => p !== "Single").map((p) => (
                <option key={p}>{p}</option>
              ))}
            </SelectField>
          ) : null}

          <div className="border border-line bg-surface p-4">
            <h3 className="font-sans text-base font-semibold">Add stock</h3>
            <div className="mt-3 flex flex-col gap-3">
              <TextField
                label="Size"
                name="size"
                list="size-choices"
                autoComplete="off"
                value={entry.size}
                onChange={(e) => setEntry({ ...entry, size: e.target.value })}
                hint="For a bra, type the size, for example 34B."
              />
              <datalist id="size-choices">
                {SIZE_CHOICES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-2" aria-label="Quick sizes">
                {QUICK_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={entry.size === s}
                    onClick={() => setEntry({ ...entry, size: s })}
                    className={`min-h-11 min-w-14 rounded-sm border px-3 text-base ${entry.size === s ? "border-primary bg-selected font-medium" : "border-control"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {form.allowColourSelection ? (
                <>
                  <TextField
                    label="Colour"
                    name="color"
                    list="colour-choices"
                    autoComplete="off"
                    value={entry.color}
                    onChange={(e) => setEntry({ ...entry, color: e.target.value })}
                  />
                  <datalist id="colour-choices">
                    {COLOUR_SUGGESTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              ) : null}
              <TextField
                label="How many in stock"
                name="qty"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="done"
                value={entry.qty}
                onChange={(e) => setEntry({ ...entry, qty: e.target.value.replace(/[^\d]/g, "") })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addVariant();
                  }
                }}
                error={entryError}
              />
              <div className="flex justify-end">
                <Button variant="secondary" onClick={addVariant}>
                  Add this line
                </Button>
              </div>
            </div>
          </div>

          {errors.variants ? (
            <p className="text-sm font-medium text-error">{errors.variants}</p>
          ) : null}

          {groups.length > 0 ? (
            <div>
              <h3 className="font-sans text-base font-semibold">
                Stock lines <span className="font-normal text-muted">· {units} units</span>
              </h3>
              <ul className="mt-2 flex flex-col gap-3">
                {groups.map((g) => (
                  <li key={g.size} className="border border-line bg-surface">
                    <p className="flex justify-between border-b border-line px-3 py-2 text-sm font-medium">
                      <span>Size {g.size}</span>
                      <span className="text-muted">{g.units} units</span>
                    </p>
                    <ul className="divide-y divide-line">
                      {g.rows.map((row) => (
                        <li
                          key={`${row.size}-${row.color}`}
                          className="flex items-center gap-2 px-3 py-1"
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-2 text-base">
                            {row.color ? (
                              <>
                                <span
                                  aria-hidden="true"
                                  className="size-4 shrink-0 rounded-full border border-rule"
                                  style={{ background: swatchFor(row.color) ?? "transparent" }}
                                />
                                <span className="truncate">{row.color}</span>
                              </>
                            ) : (
                              <span className="text-muted">Assorted</span>
                            )}
                          </span>
                          <IconButton
                            label={`One fewer ${row.size} ${row.color}`}
                            onClick={() => bump(row, -1)}
                          >
                            <Minus size={18} aria-hidden="true" />
                          </IconButton>
                          <span
                            className="tabular w-10 text-center text-base"
                            aria-label={`${row.qty} in stock`}
                          >
                            {row.qty}
                          </span>
                          <IconButton
                            label={`One more ${row.size} ${row.color}`}
                            onClick={() => bump(row, 1)}
                          >
                            <Plus size={18} aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label={`Remove ${row.size} ${row.color}`}
                            onClick={() =>
                              set("variants", removeVariant(form.variants, row.size, row.color))
                            }
                          >
                            <Trash2 size={18} aria-hidden="true" />
                          </IconButton>
                          {row.qty === 0 ? (
                            <Badge tone="error">Out</Badge>
                          ) : row.qty <= 5 ? (
                            <Badge tone="warning">Low</Badge>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {step === 2 ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="sr-only">Photos</legend>
          <p className="text-base text-muted">
            The first photograph is the one customers see in the shop. Portrait photographs work
            best. Each is reduced to fit before it is sent.
          </p>
          <input
            ref={fileInput}
            id="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => void upload(e.target.files)}
          />
          <div className="flex justify-end">
            <Button
              variant="secondary"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? "Uploading" : "Add photographs"}
            </Button>
          </div>
          {errors.images ? <p className="text-sm font-medium text-error">{errors.images}</p> : null}
          {form.images.length === 0 ? (
            <p className="border border-line bg-surface p-4 text-center text-base text-muted">
              No photographs yet. A product can be saved without one, and it will show a neutral
              tile.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {form.images.map((img, i) => (
                <li
                  key={`${img.src}-${i}`}
                  className="flex gap-3 border border-line bg-surface p-3"
                >
                  <div className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden bg-tint">
                    <Image
                      src={img.src}
                      alt=""
                      fill
                      sizes="80px"
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <TextField
                      label={
                        i === 0
                          ? "Description of the first photograph"
                          : `Description of photograph ${i + 1}`
                      }
                      name={`alt-${i}`}
                      value={img.alt}
                      onChange={(e) =>
                        set(
                          "images",
                          form.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)),
                        )
                      }
                      optional
                    />
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label="Move earlier"
                        disabled={i === 0}
                        onClick={() => moveImage(i, -1)}
                      >
                        <ArrowUp size={18} aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label="Move later"
                        disabled={i === form.images.length - 1}
                        onClick={() => moveImage(i, 1)}
                      >
                        <ArrowDown size={18} aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label="Remove photograph"
                        onClick={() =>
                          set(
                            "images",
                            form.images.filter((_, j) => j !== i),
                          )
                        }
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-4">
          <dl className="grid gap-x-6 gap-y-3 border border-line bg-surface p-4 text-base sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Name</dt>
              <dd>{form.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Category</dt>
              <dd>
                {form.category || "—"} · {form.gender || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Price</dt>
              <dd className="tabular">{form.price ? formatNaira(Number(form.price)) : "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Stock</dt>
              <dd>
                {units} units in {form.variants.length}{" "}
                {form.variants.length === 1 ? "line" : "lines"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Photographs</dt>
              <dd>{form.images.length}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">In the shop</dt>
              <dd>
                {form.active ? "Yes" : "Hidden"}
                {form.isNew ? " · New arrival" : ""}
              </dd>
            </div>
          </dl>
          {id ? (
            <div className="flex justify-start">
              <ConfirmButton
                label="Move to trash"
                title={`Move ${form.name || "this product"} to the trash?`}
                message="It disappears from the shop at once. You can restore it from the trash."
                confirmLabel="Move to trash"
                disabled={pending}
                onConfirm={() =>
                  run(() => trashProductsAction([id]), {
                    undo: { label: "Undo", run: () => restoreProductsAction([id]) },
                    onDone: (state) => {
                      if (state.ok) router.push("/admin/products");
                    },
                  })
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="admin-bar border-t border-line bg-surface px-4 py-3">
        <div className="mx-auto max-w-[1100px]">
          <ButtonRow
            secondary={
              step > 0 ? (
                <Button variant="secondary" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              ) : undefined
            }
            primary={
              last ? (
                <Button disabled={saving || uploading} onClick={() => void save()}>
                  {saving ? "Saving" : id ? "Save changes" : "Add product"}
                </Button>
              ) : (
                <Button onClick={next}>Next</Button>
              )
            }
          />
        </div>
      </div>
      <div aria-hidden="true" className="h-20" />
    </Form>
  );
}
