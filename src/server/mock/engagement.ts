import type {
  EngagementRepository,
  PublicReview,
  PublicTestimonial,
} from "@/server/data/contracts";
import { getDb, nextId } from "./db";

/** Development store for what visitors send in. Nothing is shown until it is approved, as in the database. */
let visits = 0;

export const mockEngagement: EngagementRepository = {
  async reviewsFor(productId, limit = 20): Promise<readonly PublicReview[]> {
    return getDb()
      .reviews.filter((r) => r.productId === productId && r.approved)
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        productId: r.productId,
        name: r.name,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        createdAt: r.createdAt,
      }));
  },
  async submitReview(input) {
    const db = getDb();
    db.reviews.unshift({
      id: nextId(db, "rev"),
      productId: input.productId,
      productName: db.products.find((p) => p.id === input.productId)?.name ?? "A product",
      name: input.name,
      email: input.email,
      rating: input.rating,
      title: input.title,
      comment: input.comment,
      approved: false,
      createdAt: new Date().toISOString(),
    });
    return true;
  },
  async featuredTestimonials(limit = 6): Promise<readonly PublicTestimonial[]> {
    return getDb()
      .testimonials.filter((t) => t.approved && t.featured)
      .slice(0, limit)
      .map((t) => ({
        id: t.id,
        name: t.name,
        location: t.location,
        rating: t.rating,
        comment: t.comment,
        featured: t.featured,
      }));
  },
  async submitTestimonial(input) {
    const db = getDb();
    db.testimonials.unshift({
      id: nextId(db, "tes"),
      name: input.name,
      location: input.location,
      rating: input.rating,
      comment: input.comment,
      approved: false,
      featured: false,
      createdAt: new Date().toISOString(),
    });
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
