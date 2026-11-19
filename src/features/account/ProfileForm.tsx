"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { updateProfileAction } from "@/server/actions/account";
import type { Profile } from "@/types/account";

export function ProfileForm({ profile }: { readonly profile: Profile }) {
  const toast = useToast();
  const [values, setValues] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <Form
      className="mt-6 flex max-w-xl flex-col gap-4"
      aria-label="Profile"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await updateProfileAction(values);
          if (result.ok) {
            setErrors({});
            toast.show(result.message ?? "Saved.", { tone: "success" });
          } else {
            setErrors(result.fieldErrors ?? {});
            toast.show(result.message, { tone: "error" });
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="First name"
          autoComplete="given-name"
          autoCapitalize="words"
          value={values.firstName}
          onChange={(e) => set("firstName", e.target.value)}
          error={errors.firstName}
        />
        <TextField
          label="Last name"
          autoComplete="family-name"
          autoCapitalize="words"
          value={values.lastName}
          onChange={(e) => set("lastName", e.target.value)}
          error={errors.lastName}
        />
      </div>
      <TextField
        label="Email address"
        type="email"
        value={profile.email}
        readOnly
        hint="Your email is how you sign in, so it cannot be changed here."
      />
      <TextField
        label="Phone number"
        optional
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={values.phone}
        onChange={(e) => set("phone", e.target.value)}
        error={errors.phone}
      />
      <TextField
        label="Date of birth"
        optional
        type="date"
        autoComplete="bday"
        value={values.dateOfBirth}
        onChange={(e) => set("dateOfBirth", e.target.value)}
        error={errors.dateOfBirth}
      />
      <SelectField
        label="Gender"
        optional
        value={values.gender}
        onChange={(e) => set("gender", e.target.value as typeof values.gender)}
      >
        <option value="">Prefer not to say</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
        <option value="other">Other</option>
      </SelectField>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving" : "Save profile"}
        </Button>
      </div>
    </Form>
  );
}
