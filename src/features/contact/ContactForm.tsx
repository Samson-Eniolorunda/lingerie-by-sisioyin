"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField, TextareaField } from "@/components/ui/Field";
import { whatsappLink } from "@/config/site";
import { isSubject, SUBJECTS } from "@/schemas/contact";
import { sendContact } from "@/server/actions/contact";

export function ContactForm({ initialSubject }: { readonly initialSubject: string | undefined }) {
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    subject: isSubject(initialSubject) ? initialSubject : "",
    orderNumber: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  if (sent) {
    return (
      <div role="status" className="border-l-4 border-success bg-success-bg px-4 py-5">
        <p className="font-display text-2xl">Message sent</p>
        <p className="mt-1 text-base text-ink-strong">
          Thank you. We will reply to {values.email} as soon as we can.
        </p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => {
            setSent(false);
            setValues((v) => ({ ...v, subject: "", orderNumber: "", message: "" }));
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setFailure(undefined);
        startTransition(async () => {
          try {
            const result = await sendContact({
              ...values,
              phone: values.phone || undefined,
              orderNumber: values.orderNumber || undefined,
            });
            if (result.ok) {
              setErrors({});
              setSent(true);
            } else {
              setErrors(result.fieldErrors);
              setFailure(result.message);
              const first = Object.keys(result.fieldErrors)[0];
              if (first) document.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
            }
          } catch {
            setFailure(
              "We could not send your message. Check your connection and try again, or message us on WhatsApp.",
            );
          }
        });
      }}
    >
      <TextField
        label="Name"
        name="name"
        autoComplete="name"
        autoCapitalize="words"
        enterKeyHint="next"
        value={values.name}
        onChange={set("name")}
        error={errors.name}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="next"
        value={values.email}
        onChange={set("email")}
        error={errors.email}
      />
      <TextField
        label="Phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        enterKeyHint="next"
        optional
        value={values.phone}
        onChange={set("phone")}
        error={errors.phone}
      />
      <SelectField
        label="Subject"
        name="subject"
        value={values.subject}
        onChange={set("subject")}
        error={errors.subject}
      >
        <option value="">Select a topic</option>
        {SUBJECTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Order number"
        name="orderNumber"
        optional
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="next"
        hint="Looks like LBS-18112026-0001"
        value={values.orderNumber}
        onChange={set("orderNumber")}
        error={errors.orderNumber}
      />
      <TextareaField
        label="Message"
        name="message"
        enterKeyHint="send"
        autoCapitalize="sentences"
        value={values.message}
        onChange={set("message")}
        error={errors.message}
      />
      {failure ? (
        <p
          role="alert"
          className="border-l-4 border-error bg-error-bg px-4 py-3 text-base text-error"
        >
          {failure}{" "}
          <a
            href={whatsappLink(`Hello, ${values.message.slice(0, 200)}`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Message us on WhatsApp
          </a>
        </p>
      ) : null}
      <Button type="submit" block disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
