import { adminPath } from "@/lib/adminPath";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { FilterBar, Pager } from "@/features/admin/Filters";
import { PageHeader } from "@/features/admin/PageHeader";
import { ProductList } from "@/features/admin/ProductList";
import { can } from "@/lib/permissions";
import { CATEGORIES } from "@/schemas/admin";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";
import { pageFor, parsePageNumber } from "@/server/paging";
import Link from "next/link";

export const metadata: Metadata = { title: "Products" };
const PER_PAGE = 12;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    stock?: string;
    view?: string;
    page?: string;
  }>;
}) {
  const user = await requireStaff("products.manage", adminPath("/products"));
  const { q = "", category = "", stock = "", view, page } = await searchParams;
  const trash = view === "trash";
  const pageNumber = parsePageNumber(page);
  const stockFilter = stock === "in" || stock === "out" || stock === "low" ? stock : undefined;
  const [counts, { items: shown, total }] = await Promise.all([
    data.admin.productCounts(),
    data.admin.products(
      { trash, category, stock: stockFilter, search: q },
      pageFor(pageNumber, PER_PAGE),
    ),
  ]);
  const inTrash = counts.trashed;

  return (
    <>
      <PageHeader
        title={trash ? "Trash" : "Products"}
        lead={
          trash
            ? "Removed products wait here until you restore or delete them."
            : `${total} ${total === 1 ? "product" : "products"}`
        }
        actions={
          trash ? (
            <Link
              href={adminPath("/products")}
              className="inline-flex min-h-11 items-center text-base"
            >
              Back to products
            </Link>
          ) : (
            <ButtonLink href={adminPath("/products/new")}>Add a product</ButtonLink>
          )
        }
      />
      {!trash ? (
        <>
          <FilterBar
            action={adminPath("/products")}
            search={{
              name: "q",
              label: "Search products",
              value: q,
              placeholder: "Name or category",
            }}
            select={{
              name: "category",
              label: "Category",
              value: category,
              options: [
                { value: "", label: "All categories" },
                ...CATEGORIES.map((c) => ({ value: c, label: c })),
              ],
            }}
            extra={
              <label className="flex flex-col gap-1.5 text-sm font-medium sm:w-44">
                Stock
                <select
                  name="stock"
                  defaultValue={stock}
                  className="min-h-12 w-full rounded-sm border border-control bg-surface px-3 text-base font-normal"
                >
                  <option value="">Any stock</option>
                  <option value="in">In stock</option>
                  <option value="low">Running low</option>
                  <option value="out">Out of stock</option>
                </select>
              </label>
            }
          />
          {inTrash > 0 ? (
            <p className="mb-4 text-sm">
              <Link
                href={adminPath("/products?view=trash")}
                className="inline-flex min-h-11 items-center"
              >
                Trash ({inTrash})
              </Link>
            </p>
          ) : null}
        </>
      ) : null}
      <ProductList
        trash={trash}
        canDeleteForever={can(user.role, "roles.manage")}
        rows={shown.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          priceNgn: p.priceNgn,
          qty: p.qty,
          active: p.active,
          image: p.images[0]?.src ?? null,
          deletedLabel: p.deletedAt,
        }))}
      />
      <Pager
        base={adminPath("/products")}
        params={{ q, category, stock, ...(trash ? { view: "trash" } : {}) }}
        page={pageNumber}
        perPage={PER_PAGE}
        total={total}
      />
    </>
  );
}
