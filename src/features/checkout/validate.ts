import { contactSchema, deliverySchema } from "@/schemas/checkout";

export interface CheckoutValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  landmark: string;
  notes: string;
}

export const EMPTY_VALUES: CheckoutValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  landmark: "",
  notes: "",
};

export type Errors = Partial<Record<keyof CheckoutValues, string>>;

function collect(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Errors {
  const errors: Errors = {};
  for (const issue of issues) {
    const key = String(issue.path[0]) as keyof CheckoutValues;
    errors[key] ??= issue.message;
  }
  return errors;
}

export function validateContact(values: CheckoutValues): Errors {
  const result = contactSchema.safeParse(values);
  return result.success ? {} : collect(result.error.issues);
}

export function validateDelivery(values: CheckoutValues): Errors {
  const result = deliverySchema.safeParse({
    address: values.address,
    city: values.city,
    state: values.state,
    landmark: values.landmark || undefined,
    notes: values.notes || undefined,
  });
  return result.success ? {} : collect(result.error.issues);
}
