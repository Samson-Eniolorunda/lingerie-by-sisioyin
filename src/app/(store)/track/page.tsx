import type { Metadata } from "next";
import { TrackForm } from "@/features/orders/TrackForm";

export const metadata: Metadata = {
  title: "Track an order",
  robots: { index: false, follow: false },
  alternates: { canonical: "/track" },
};

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.order ?? params.id;
  const initial = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return (
    <div className="mx-auto max-w-[560px] px-4 py-10 sm:py-16">
      <h1 className="font-display text-4xl md:text-5xl">Track an order</h1>
      <p className="mt-2 mb-6 text-base text-muted">
        Enter your order number and the email address you used.
      </p>
      <TrackForm initialOrder={initial.slice(0, 30)} />
    </div>
  );
}
