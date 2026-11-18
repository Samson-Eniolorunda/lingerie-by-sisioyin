import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/features/admin/PageHeader";
import { ProductEditor } from "@/features/admin/ProductEditor";
import { requireStaff } from "@/server/auth/session";

export const metadata: Metadata = { title: "Add a product" };

export default async function NewProductPage() {
  await requireStaff("products.manage", "/admin/products/new");
  return (
    <>
      <p className="mb-2">
        <Link href="/admin/products" className="inline-flex min-h-11 items-center text-sm">
          ← Products
        </Link>
      </p>
      <PageHeader title="Add a product" />
      <ProductEditor
        id={null}
        initial={{
          name: "",
          category: "",
          gender: "",
          price: "",
          description: "",
          deliveryType: "standard",
          isNew: true,
          active: true,
          allowColourSelection: true,
          packType: "Single",
          variants: [],
          images: [],
        }}
      />
    </>
  );
}
