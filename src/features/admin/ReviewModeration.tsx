"use client";

import { Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/features/admin/PageHeader";
import { formatDateTime } from "@/lib/dates";
import {
  deleteReviewAction,
  deleteTestimonialAction,
  setReviewApprovedAction,
  setTestimonialAction,
} from "@/server/actions/admin";
import type { AdminReview, AdminTestimonial } from "@/types/account";
import { ConfirmButton } from "./ConfirmButton";
import { useAdminAction } from "./useAdminAction";

function Stars({ rating }: { readonly rating: number }) {
  return (
    <span
      aria-label={`${rating} out of 5`}
      className="inline-flex items-center gap-0.5 text-primary"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={16} aria-hidden="true" fill={n <= rating ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { readonly review: AdminReview }) {
  const { run, pending } = useAdminAction();
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold">{review.productName}</p>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Stars rating={review.rating} /> {review.name}
            {review.email ? ` · ${review.email}` : ""} · {formatDateTime(review.createdAt)}
          </p>
        </div>
        <Badge tone={review.approved ? "success" : "warning"}>
          {review.approved ? "Shown" : "Waiting"}
        </Badge>
      </div>
      {review.title ? <p className="mt-2 text-base font-medium">{review.title}</p> : null}
      <p className="mt-1 text-base">{review.comment}</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <ConfirmButton
          label="Delete"
          title="Delete this review?"
          message="It is removed for good."
          confirmLabel="Delete"
          disabled={pending}
          onConfirm={() => run(() => deleteReviewAction(review.id))}
        />
        <Button
          disabled={pending}
          onClick={() => run(() => setReviewApprovedAction(review.id, !review.approved))}
        >
          {review.approved ? "Hide" : "Approve"}
        </Button>
      </div>
    </Panel>
  );
}

function TestimonialCard({ item }: { readonly item: AdminTestimonial }) {
  const { run, pending } = useAdminAction();
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
            <Stars rating={item.rating} /> {item.name}
            {item.location ? (
              <span className="font-normal text-muted">· {item.location}</span>
            ) : null}
          </p>
          <p className="text-sm text-muted">{formatDateTime(item.createdAt)}</p>
        </div>
        <span className="flex gap-2">
          {item.featured ? <Badge tone="info">On the home page</Badge> : null}
          <Badge tone={item.approved ? "success" : "warning"}>
            {item.approved ? "Shown" : "Waiting"}
          </Badge>
        </span>
      </div>
      <p className="mt-2 text-base">{item.comment}</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <ConfirmButton
          label="Delete"
          title="Delete this testimonial?"
          message="It is removed for good."
          confirmLabel="Delete"
          disabled={pending}
          onConfirm={() => run(() => deleteTestimonialAction(item.id))}
        />
        {item.approved ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => setTestimonialAction(item.id, { featured: !item.featured }))}
          >
            {item.featured ? "Remove from home page" : "Show on home page"}
          </Button>
        ) : null}
        <Button
          disabled={pending}
          onClick={() => run(() => setTestimonialAction(item.id, { approved: !item.approved }))}
        >
          {item.approved ? "Hide" : "Approve"}
        </Button>
      </div>
    </Panel>
  );
}

export function ReviewModeration({
  reviews,
  testimonials,
}: {
  readonly reviews: readonly AdminReview[];
  readonly testimonials: readonly AdminTestimonial[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="reviews-heading" className="flex flex-col gap-3">
        <h3 id="reviews-heading" className="font-sans text-lg font-semibold">
          Product reviews ({reviews.length})
        </h3>
        {reviews.length === 0 ? (
          <p className="text-base text-muted">No reviews here.</p>
        ) : (
          reviews.map((r) => <ReviewCard key={r.id} review={r} />)
        )}
      </section>
      <section aria-labelledby="testimonials-heading" className="flex flex-col gap-3">
        <h3 id="testimonials-heading" className="font-sans text-lg font-semibold">
          Testimonials ({testimonials.length})
        </h3>
        {testimonials.length === 0 ? (
          <p className="text-base text-muted">No testimonials here.</p>
        ) : (
          testimonials.map((t) => <TestimonialCard key={t.id} item={t} />)
        )}
      </section>
    </div>
  );
}
