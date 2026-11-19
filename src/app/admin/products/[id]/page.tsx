import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/PageHeader";
import { ProductEditor } from "@/features/admin/ProductEditor";
import { rowsFromProduct } from "@/lib/variants";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff("products.manage", `/admin/products/${id}`);
  const product = await data.admin.product(id);
  if (!product || product.deletedAt !== null) notFound();
  return (
    <>
      <p className="mb-2">
        <Link href="/admin/products" className="inline-flex min-h-11 items-center text-sm">
          ← Products
        </Link>
      </p>
      <PageHeader title={product.name} lead="Edit details, stock and photographs." />
      <ProductEditor
        id={product.id}
        stockVersion={product.stockVersion}
        initial={{
          name: product.name,
          category: product.category,
          gender: product.gender,
          price: String(product.priceNgn),
          description: product.description,
          deliveryType: product.deliveryType,
          isNew: product.isNew,
          active: product.active,
          allowColourSelection: product.allowColourSelection,
          packType: product.packType,
          variants: rowsFromProduct(product),
          images: product.images.map((i) => ({ src: i.src, alt: i.alt })),
        }}
      />
    </>
  );
}
