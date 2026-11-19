"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface TocItem {
  readonly id: string;
  readonly title: string;
}

/** Table of contents that marks the section in view. A collapsed "On this page" row on phones, a sticky list from 1024 px. */
export function Toc({ items }: { readonly items: readonly TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first) setActive(first.target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  const list = (
    <ol className="space-y-0.5">
      {items.map((item, i) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            aria-current={active === item.id ? "location" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 text-base no-underline",
              active === item.id ? "font-medium text-primary" : "text-muted",
            )}
          >
            <span className="tabular w-5 text-sm text-subtle">{i + 1}</span>
            {item.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <details className="mt-6 border border-line bg-surface lg:hidden">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 text-base font-medium">
          On this page
        </summary>
        <nav aria-label="On this page" className="px-4 pb-3">
          {list}
        </nav>
      </details>
      <nav aria-label="Contents" className="sticky top-24 hidden self-start lg:block">
        {list}
      </nav>
    </>
  );
}
