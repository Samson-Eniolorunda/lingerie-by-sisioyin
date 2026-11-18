"use client";

import Link from "next/link";
import { ChevronDown, Search, X } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { RichText } from "@/components/ui/RichText";
import { Tabs } from "@/components/ui/Tabs";
import { FAQ_GROUPS } from "@/content";
import type { ContentNode } from "@/content/schema";
import { whatsappLink } from "@/config/site";
import { cn } from "@/lib/cn";

function textOf(nodes: readonly ContentNode[]): string {
  return nodes.map((n) => (typeof n === "string" ? n : textOf(n.c))).join(" ");
}

export function FaqView() {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const base = useId();

  const groups = useMemo(() => {
    return FAQ_GROUPS.filter((g) => deferred !== "" || tab === "all" || g.id === tab)
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            deferred === "" || `${item.q} ${textOf(item.a)}`.toLowerCase().includes(deferred),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [tab, deferred]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
        <label htmlFor={`${base}-q`} className="sr-only">
          Search the questions
        </label>
        <Search
          size={20}
          strokeWidth={1.5}
          aria-hidden="true"
          className="pointer-events-none absolute top-3.5 left-3 text-subtle"
        />
        <input
          id={`${base}-q`}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(null);
          }}
          placeholder="Search the questions"
          className="min-h-12 w-full rounded-sm border border-control bg-surface pr-12 pl-10 text-base"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute top-0.5 right-0 flex size-11 items-center justify-center text-muted"
            onClick={() => setQuery("")}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        ) : null}
      </form>

      <Tabs
        label="Question groups"
        className="mt-3"
        items={[
          { id: "all", label: "All" },
          ...FAQ_GROUPS.map((g) => ({ id: g.id, label: g.title })),
        ]}
        value={deferred === "" ? tab : "none"}
        onChange={(id) => {
          setTab(id);
          setQuery("");
          setOpen(null);
        }}
      />

      <p className="mt-4 text-sm text-subtle" aria-live="polite">
        {total} {total === 1 ? "question" : "questions"}
      </p>

      {total === 0 ? (
        <div className="py-12 text-center">
          <p className="font-display text-2xl">No questions match</p>
          <p className="mt-2 text-base text-muted">
            <button
              type="button"
              className="min-h-11 text-primary underline underline-offset-4"
              onClick={() => setQuery("")}
            >
              Clear search
            </button>{" "}
            or{" "}
            <a
              href={whatsappLink("Hello, I have a question.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              ask us on WhatsApp
            </a>
            .
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.id} aria-labelledby={`${base}-${group.id}`} className="mt-6">
            <h2 id={`${base}-${group.id}`} className="font-display text-2xl">
              {group.title}
            </h2>
            <div className="mt-2 border-t border-line">
              {group.items.map((item, i) => {
                const id = `${group.id}-${i}`;
                const isOpen = open === id;
                return (
                  <div key={id} className="border-b border-line">
                    <h3 className="font-sans">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`${base}-a-${id}`}
                        onClick={() => setOpen(isOpen ? null : id)}
                        className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left text-base font-medium"
                      >
                        <span>{item.q}</span>
                        <ChevronDown
                          size={20}
                          strokeWidth={1.5}
                          aria-hidden="true"
                          className={cn("shrink-0", isOpen && "rotate-180")}
                        />
                      </button>
                    </h3>
                    <div id={`${base}-a-${id}`} hidden={!isOpen} className="pb-4">
                      <RichText nodes={item.a} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <section className="mt-14 border-t border-line pt-8 text-center">
        <h2 className="font-display text-3xl">Still have questions?</h2>
        <p className="mx-auto mt-2 max-w-md text-base text-muted">
          Send us a message and we will reply as soon as we can.
        </p>
        <Link
          href="/contact"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-sm bg-primary px-6 text-base font-medium text-on-primary no-underline hover:bg-primary-hover hover:text-on-primary"
        >
          Contact us
        </Link>
      </section>
    </div>
  );
}
