import { mockAccount } from "@/server/mock/account";
import { mockAdmin } from "@/server/mock/admin";
import { mockAuth } from "@/server/mock/auth";
import type { DataLayer } from "./contracts";

/**
 * The one place that chooses the implementation. The Supabase layer will implement `DataLayer` and
 * be returned here when `NEXT_PUBLIC_SUPABASE_URL` is set; the pages and actions do not change.
 */
export const data: DataLayer = { auth: mockAuth, account: mockAccount, admin: mockAdmin };

export const DATA_MODE: "mock" | "supabase" = "mock";
