"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  readonly id: string;
  readonly label: string;
}

/** A row of 44 px tabs with roles, arrow-key movement and a selected state that is not colour alone. */
export function Tabs({
  items,
  value,
  onChange,
  label,
  idBase,
  className,
}: {
  readonly items: readonly TabItem[];
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly label: string;
  /** Prefix for the tab ids and the panel id (`<idBase>-panel`) the tabs control. */
  readonly idBase: string;
  readonly className?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((item) => item.id === value);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = items[(index + step + items.length) % items.length];
    if (next) {
      onChange(next.id);
      refs.current[next.id]?.focus();
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("-mx-4 flex scrollbar-none gap-1 overflow-x-auto px-4", className)}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[item.id] = node;
            }}
            id={`${idBase}-tab-${item.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${idBase}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              "min-h-11 shrink-0 border-b-2 px-4 text-base font-medium",
              selected
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function tabPanelProps(idBase: string, activeId: string) {
  return {
    role: "tabpanel",
    id: `${idBase}-panel`,
    "aria-labelledby": `${idBase}-tab-${activeId}`,
  } as const;
}
