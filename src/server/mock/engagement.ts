import type {
  EngagementRepository,
  PublicReview,
  PublicTestimonial,
} from "@/server/data/contracts";

/** Development store for what visitors send in. Nothing is shown until it is approved, as in the database. */
const reviews: PublicReview[] = [];
const testimonials: PublicTestimonial[] = [];
let visits = 0;

export const mockEngagement: EngagementRepository = {
  async reviewsFor(productId, limit = 20) {
    return reviews.filter((r) => r.productId === productId).slice(0, limit);
  },
  async submitReview() {
    return true;
  },
  async featuredTestimonials(limit = 6) {
    return testimonials.filter((t) => t.featured).slice(0, limit);
  },
  async submitTestimonial() {
    return true;
  },
  async recordVisit() {
    visits += 1;
    return `mock-visit-${visits}`;
  },
  async visitDuration() {
    // Nothing to keep in the development store.
  },
};
