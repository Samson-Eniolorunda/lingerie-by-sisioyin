import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/features/admin/Filters";
import { PageHeader } from "@/features/admin/PageHeader";
import { ReviewModeration } from "@/features/admin/ReviewModeration";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";
import { pageFor, parsePageNumber } from "@/server/paging";

export const metadata: Metadata = { title: "Reviews and testimonials" };
export const dynamic = "force-dynamic";
const PER_PAGE = 10;

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; page?: string }>;
}) {
  await requireStaff("products.manage", "/admin/reviews");
  const { show, page } = await searchParams;
  const status = show === "approved" ? "approved" : "pending";
  const pageNumber = parsePageNumber(page);
  const paging = pageFor(pageNumber, PER_PAGE);
  const [reviews, testimonials, pendingReviews, pendingTestimonials] = await Promise.all([
    data.admin.reviews(status, paging),
    data.admin.testimonials(status, paging),
    data.admin.reviews("pending", { limit: 1, offset: 0 }),
    data.admin.testimonials("pending", { limit: 1, offset: 0 }),
  ]);
  const tab = (value: "pending" | "approved", label: string) => (
    <Link
      href={`/admin/reviews?show=${value}`}
      aria-current={status === value ? "page" : undefined}
      className={`inline-flex min-h-11 items-center border-b-2 px-3 text-base ${status === value ? "border-primary font-semibold" : "border-transparent"}`}
    >
      {label}
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Reviews and testimonials"
        lead="Nothing a visitor sends in is shown on the shop until you approve it."
      />
      <nav aria-label="Filter" className="mb-5 flex gap-1 border-b border-line">
        {tab("pending", `Waiting (${pendingReviews.total + pendingTestimonials.total})`)}
        {tab("approved", "Shown on the shop")}
      </nav>
      <ReviewModeration reviews={reviews.items} testimonials={testimonials.items} />
      <Pager
        base="/admin/reviews"
        params={{ show: status }}
        page={pageNumber}
        perPage={PER_PAGE}
        total={Math.max(reviews.total, testimonials.total)}
      />
    </>
  );
}
