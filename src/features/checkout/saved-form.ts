import { readStorage, writeStorage } from "@/lib/storage";
import { EMPTY_VALUES, type CheckoutValues } from "./validate";

export const FORM_KEY = "LBS_CHECKOUT_FORM";
export const ATTEMPT_KEY = "LBS_CHECKOUT_ATTEMPT";

/** The values to start from. A signed-in account never reads saved personal details (an earlier guest's); only the account's own. */
export function startingValues(
  raw: string | null,
  stateFromBag: string,
  account: Pick<
    CheckoutValues,
    "email" | "firstName" | "lastName" | "phone" | "address" | "city" | "state"
  > | null,
): CheckoutValues {
  let saved: CheckoutValues = EMPTY_VALUES;
  if (raw) {
    try {
      saved = { ...EMPTY_VALUES, ...(JSON.parse(raw) as Partial<CheckoutValues>) };
    } catch {
      saved = EMPTY_VALUES;
    }
  }
  if (!account) return { ...saved, state: stateFromBag || saved.state };
  return {
    ...EMPTY_VALUES,
    landmark: "",
    notes: "",
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    phone: account.phone,
    address: account.address,
    city: account.city,
    state: stateFromBag || account.state,
  };
}

/** Guests keep the form between visits; a signed-in account's details are never written to the device. */
export function saveForm(values: CheckoutValues, signedIn: boolean): void {
  if (!signedIn) writeStorage(FORM_KEY, JSON.stringify(values));
}

/** After an order a guest keeps only their contact details for next time. */
export function saveContactAfterOrder(values: CheckoutValues, signedIn: boolean): void {
  if (signedIn) return;
  writeStorage(
    FORM_KEY,
    JSON.stringify({
      ...EMPTY_VALUES,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
    }),
  );
}

/** Called when a customer signs out, so the next person on this device starts clean. */
export function clearCheckoutStorage(): void {
  try {
    window.localStorage.removeItem(FORM_KEY);
    window.localStorage.removeItem(ATTEMPT_KEY);
  } catch {
    /* storage blocked: nothing was saved */
  }
}

export const readSavedForm = () => readStorage(FORM_KEY);
