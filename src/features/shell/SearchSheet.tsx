"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { formatNaira } from "@/lib/money";
import { searchProducts, type SearchHit, type SearchResult } from "@/server/actions/search";
import { useShell } from "./ShellContext";

const EMPTY: SearchResult = { hits: [], fallback: [], total: 0 };

function Row({ hit, onNavigate }: { readonly hit: SearchHit; readonly onNavigate: () => void }) {
  return (
    <li>
      <Link
        href={`/products/${hit.slug}`}
        onClick={onNavigate}
        className="flex min-h-14 items-center gap-3 py-2 text-ink no-underline hover:bg-tint"
      >
        <span className="relative size-12 shrink-0 overflow-hidden bg-tint">
          {hit.image ? (
            <Image
              src={hit.image}
              alt=""
              fill
              sizes="48px"
              unoptimized={hit.image.endsWith(".svg")}
              className="object-cover"
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base">{hit.name}</span>
          <span className="block text-sm text-subtle">{hit.category}</span>
        </span>
        <span className="tabular text-base">{formatNaira(hit.priceNgn)}</span>
      </Link>
    </li>
  );
}

/** Opens from the bottom navigation and from Ctrl or Cmd + K, with the keyboard up. */
export function SearchSheet() {
  const shell = useShell();
  const open = shell.panel === "search";
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<SearchResult>(EMPTY);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        shell.open("search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shell]);

  useEffect(() => {
    if (term.trim().length < 2) return;
    const handle = window.setTimeout(() => {
      startTransition(async () => setResult(await searchProducts(term)));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [term]);

  const searched = term.trim().length >= 2;
  const visible = searched ? result : EMPTY;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? shell.open("search") : shell.close())}
      title="Search"
      className="h-[100dvh] sm:h-auto"
    >
      <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
        <label htmlFor="site-search" className="sr-only">
          Search products
        </label>
        <Search
          size={20}
          strokeWidth={1.5}
          aria-hidden="true"
          className="pointer-events-none absolute top-3.5 left-3 text-subtle"
        />
        <input
          id="site-search"
          ref={input}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Name, category or description"
          className="min-h-12 w-full rounded-sm border border-control bg-surface pr-12 pl-10 text-base"
        />
        {term ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setTerm("");
              input.current?.focus();
            }}
            className="absolute top-0.5 right-0 flex size-11 items-center justify-center text-muted"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        ) : null}
      </form>

      <div aria-live="polite" className="mt-4">
        {searched && !pending && visible.hits.length > 0 ? (
          <>
            <ul>
              {visible.hits.map((hit) => (
                <Row key={hit.id} hit={hit} onNavigate={shell.close} />
              ))}
            </ul>
            <Link
              href={`/shop?search=${encodeURIComponent(term.trim())}`}
              onClick={shell.close}
              className="mt-2 flex min-h-12 items-center text-base font-medium"
            >
              View all {visible.total} results
            </Link>
          </>
        ) : null}
        {searched && !pending && visible.hits.length === 0 ? (
          <>
            <p className="text-base text-muted">
              Nothing matched “{term.trim()}”. You might like these instead.
            </p>
            <ul className="mt-2">
              {visible.fallback.map((hit) => (
                <Row key={hit.id} hit={hit} onNavigate={shell.close} />
              ))}
            </ul>
          </>
        ) : null}
        {searched && pending ? <p className="text-base text-muted">Searching…</p> : null}
        {!searched ? <p className="text-sm text-subtle">Type at least two letters.</p> : null}
      </div>
    </Sheet>
  );
}
