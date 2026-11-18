"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button, ButtonRow } from "@/components/ui/Button";
import { formatNaira } from "@/lib/money";
import {
  deleteProductForeverAction,
  emptyTrashAction,
  restoreProductsAction,
  trashProductsAction,
} from "@/server/actions/admin";
import { ConfirmButton } from "./ConfirmButton";
import { useAdminAction } from "./useAdminAction";

export interface ProductRow {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly priceNgn: number;
  readonly qty: number;
  readonly active: boolean;
  readonly image: string | null;
  readonly deletedLabel: string | null;
}

function Stock({ qty }: { readonly qty: number }) {
  if (qty === 0) return <span className="font-medium text-error">Out of stock</span>;
  if (qty <= 5) return <span className="font-medium text-warning">{qty} left</span>;
  return <span className="text-muted">{qty} in stock</span>;
}

export function ProductList({
  rows,
  trash,
  canDeleteForever,
}: {
  readonly rows: readonly ProductRow[];
  readonly trash: boolean;
  readonly canDeleteForever: boolean;
}) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const { run, pending } = useAdminAction();
  const toggle = (id: string) =>
    setSelected((all) => (all.includes(id) ? all.filter((x) => x !== id) : [...all, id]));

  function trashSelected() {
    const ids = selected;
    run(() => trashProductsAction(ids), {
      onDone: () => setSelected([]),
      undo: { label: "Undo", run: () => restoreProductsAction(ids) },
    });
  }

  if (rows.length === 0)
    return (
      <div className="border border-line bg-surface p-6 text-center text-base text-muted">
        {trash ? "The trash is empty." : "No products match."}
      </div>
    );

  return (
    <>
      {trash ? (
        <div className="mb-4 flex justify-end">
          {canDeleteForever ? (
            <ConfirmButton
              label="Empty the trash"
              title="Empty the trash?"
              message="Every product in the trash is deleted for good. This cannot be undone."
              confirmLabel="Delete them all"
              onConfirm={() => run(() => emptyTrashAction())}
            />
          ) : null}
        </div>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => (
          <li key={p.id} className="flex gap-3 border border-line bg-surface p-3">
            <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden bg-tint">
              {p.image ? (
                <Image
                  src={p.image}
                  alt=""
                  fill
                  sizes="96px"
                  unoptimized
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-base leading-snug font-medium">{p.name}</p>
                {!trash ? (
                  <label className="-mt-1 -mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      onChange={() => toggle(p.id)}
                      className="size-6 accent-[var(--c-primary)]"
                    />
                    <span className="sr-only">Select {p.name}</span>
                  </label>
                ) : null}
              </div>
              <p className="text-sm text-muted">
                {p.category}
                {!p.active && !trash ? " · Hidden from the shop" : ""}
              </p>
              <p className="tabular mt-1 text-base">{formatNaira(p.priceNgn)}</p>
              <p className="text-sm">
                <Stock qty={p.qty} />
              </p>
              <div className="mt-auto flex flex-wrap justify-end gap-2 pt-2">
                {trash ? (
                  <>
                    {canDeleteForever ? (
                      <ConfirmButton
                        label="Delete for good"
                        title={`Delete ${p.name} for good?`}
                        message="It cannot be restored afterwards."
                        confirmLabel="Delete for good"
                        onConfirm={() => run(() => deleteProductForeverAction(p.id))}
                      />
                    ) : null}
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => run(() => restoreProductsAction([p.id]))}
                    >
                      Restore
                    </Button>
                  </>
                ) : (
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-sm border border-control px-5 text-base text-ink no-underline hover:bg-tint"
                  >
                    Edit
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {selected.length > 0 ? (
        <div
          role="region"
          aria-label="Selected products"
          className="admin-bar border-t border-line bg-surface px-4 py-3"
        >
          <ButtonRow
            secondary={
              <Button variant="secondary" onClick={() => setSelected([])}>
                Clear
              </Button>
            }
            primary={
              <ConfirmButton
                label={`Move ${selected.length} to trash`}
                title={`Move ${selected.length} ${selected.length === 1 ? "product" : "products"} to the trash?`}
                message="They disappear from the shop at once. You can restore them from the trash."
                confirmLabel="Move to trash"
                variant="danger"
                onConfirm={trashSelected}
              />
            }
          />
        </div>
      ) : null}
    </>
  );
}
