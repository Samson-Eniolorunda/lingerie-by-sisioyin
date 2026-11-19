import { DATA_MODE } from "@/config/data-mode";
import { mockAccount } from "@/server/mock/account";
import { mockAdmin } from "@/server/mock/admin";
import { mockAuth } from "@/server/mock/auth";
import { mockCatalogue } from "@/server/mock/catalogue";
import { mockContact } from "@/server/mock/contact";
import { mockOrders } from "@/server/mock/orders";
import type { DataLayer } from "./contracts";

export { DATA_MODE };

const mock: DataLayer = {
  catalogue: mockCatalogue,
  orders: mockOrders,
  contact: mockContact,
  auth: mockAuth,
  account: mockAccount,
  admin: mockAdmin,
};

/**
 * With the Supabase address and key configured this must return the Supabase implementation of the
 * contracts. That layer is not written yet, so a configured deployment fails loudly with a clear
 * message instead of quietly serving development data.
 */
function notConnected(): DataLayer {
  const fail = (): never => {
    throw new Error(
      "Supabase is configured but its data layer is not implemented in this build. Remove NEXT_PUBLIC_SUPABASE_URL to use the development store.",
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
  };
}

export const data: DataLayer = DATA_MODE === "mock" ? mock : notConnected();
