import { DATA_MODE } from "@/config/data-mode";
import { mockAccount } from "@/server/mock/account";
import { mockAdmin } from "@/server/mock/admin";
import { mockAuth } from "@/server/mock/auth";
import { mockCatalogue } from "@/server/mock/catalogue";
import { mockContact } from "@/server/mock/contact";
import { mockEngagement } from "@/server/mock/engagement";
import { mockOrders } from "@/server/mock/orders";
import { mockPayments } from "@/server/mock/payments";
import { supabaseAccount } from "@/server/supabase/account";
import { supabaseAdmin } from "@/server/supabase/admin";
import { supabaseAuth } from "@/server/supabase/auth";
import { supabaseCatalogue } from "@/server/supabase/catalogue";
import { supabaseContact } from "@/server/supabase/contact";
import { supabaseEngagement } from "@/server/supabase/engagement";
import { supabaseOrders } from "@/server/supabase/orders";
import { supabasePayments } from "@/server/supabase/payments";
import type { DataLayer } from "./contracts";

export { DATA_MODE };

const mock: DataLayer = {
  catalogue: mockCatalogue,
  orders: mockOrders,
  contact: mockContact,
  auth: mockAuth,
  account: mockAccount,
  admin: mockAdmin,
  engagement: mockEngagement,
  payments: mockPayments,
};

const supabase: DataLayer = {
  catalogue: supabaseCatalogue,
  orders: supabaseOrders,
  contact: supabaseContact,
  auth: supabaseAuth,
  account: supabaseAccount,
  admin: supabaseAdmin,
  engagement: supabaseEngagement,
  payments: supabasePayments,
};

/**
 * A production build with no Supabase configuration refuses every call with a message that names
 * the missing variables. It never serves invented data: the development store is for a developer's
 * machine and for demonstrations switched on with `LBS_ALLOW_DEMO=true` (see `config/data-mode.ts`).
 */
function unconfigured(): DataLayer {
  const fail = (): never => {
    throw new Error(
      "The shop's database is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (see OWNER_SETUP.md).",
    );
  };
  const area = new Proxy({}, { get: fail });
  return {
    catalogue: area as DataLayer["catalogue"],
    orders: area as DataLayer["orders"],
    contact: area as DataLayer["contact"],
    auth: area as DataLayer["auth"],
    account: area as DataLayer["account"],
    admin: area as DataLayer["admin"],
    engagement: area as DataLayer["engagement"],
    payments: area as DataLayer["payments"],
  };
}

export const data: DataLayer =
  DATA_MODE === "supabase" ? supabase : DATA_MODE === "mock" ? mock : unconfigured();
