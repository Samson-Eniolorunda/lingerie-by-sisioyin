import type {
  EngagementRepository,
  PublicReview,
  PublicTestimonial,
  VisitInput,
} from "@/server/data/contracts";
import { clientIp } from "@/server/auth/request";
import { allowRequest } from "@/server/rate-limit";
import { anonClient } from "./clients";
import { must, num, str } from "./util";

/** Reviews and testimonials are public writes: limited per address and per author in the shared store. */
async function publicWriteAllowed(scope: string, author: string): Promise<boolean> {
  return allowRequest(scope, await clientIp(), [author], {
    ip: 10,
    subject: 5,
    windowMs: 3_600_000,
  });
}

export const supabaseEngagement: EngagementRepository = {
  async reviewsFor(productId: string, limit = 20): Promise<readonly PublicReview[]> {
    const rows = must(
      await anonClient()
        .from("reviews_public")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
    return rows.map((r) => ({
      id: str(r.id),
      productId: str(r.product_id),
      name: str(r.customer_name),
      rating: num(r.rating),
      title: str(r.title),
      comment: str(r.comment),
      createdAt: str(r.created_at),
    }));
  },

  async submitReview(input: {
    productId: string;
    name: string;
    email: string;
    rating: number;
    title: string;
    comment: string;
  }): Promise<boolean> {
    if (!(await publicWriteAllowed("review", input.email))) return false;
    const { error } = await anonClient().from("reviews").insert({
      product_id: input.productId,
      customer_name: input.name,
      customer_email: input.email,
      rating: input.rating,
      title: input.title,
      comment: input.comment,
    });
    return !error;
  },

  async featuredTestimonials(limit = 6): Promise<readonly PublicTestimonial[]> {
    const rows = must(
      await anonClient()
        .from("testimonials_public")
        .select("*")
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
    return rows.map((r) => ({
      id: str(r.id),
      name: str(r.customer_name),
      location: str(r.customer_location),
      rating: num(r.rating),
      comment: str(r.comment),
      featured: Boolean(r.is_featured),
    }));
  },

  async submitTestimonial(input: {
    name: string;
    location: string;
    rating: number;
    comment: string;
  }): Promise<boolean> {
    if (!(await publicWriteAllowed("testimonial", input.name))) return false;
    const { error } = await anonClient().from("testimonials").insert({
      customer_name: input.name,
      customer_location: input.location,
      rating: input.rating,
      comment: input.comment,
    });
    return !error;
  },

  /** Page views. The address and location are never taken from the browser; only the page, device and browser. */
  async recordVisit(input: VisitInput): Promise<string | null> {
    const { data, error } = await anonClient().rpc("record_visit", {
      p_page: input.page,
      p_referrer: input.referrer ?? null,
      p_device_type: input.deviceType ?? null,
      p_browser: input.browser ?? null,
      p_os: input.os ?? null,
      p_screen_resolution: input.screen ?? null,
      p_viewport_size: input.viewport ?? null,
    });
    return error ? null : (data as string);
  },

  async visitDuration(id: string, seconds: number): Promise<void> {
    await anonClient().rpc("update_visit_duration", { p_id: id, p_seconds: Math.round(seconds) });
  },
};
