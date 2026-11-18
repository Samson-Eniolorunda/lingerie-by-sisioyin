"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { whatsappLink } from "@/config/site";

export function ShareRow({ name, url }: { readonly name: string; readonly url: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        return;
      }
    }
    await copy();
  }
  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  const link = "flex min-h-11 items-center px-2 text-base";

  return (
    <div className="flex flex-wrap items-center gap-x-2">
      <Button variant="text" onClick={share} className="gap-2">
        <Share2 size={18} strokeWidth={1.5} aria-hidden="true" /> Share
      </Button>
      <a
        className={link}
        target="_blank"
        rel="noopener noreferrer"
        href={whatsappLink(`${name} ${url}`)}
      >
        WhatsApp
      </a>
      <a
        className={link}
        target="_blank"
        rel="noopener noreferrer"
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
      >
        Facebook
      </a>
      <a
        className={link}
        target="_blank"
        rel="noopener noreferrer"
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(name)}&url=${encodeURIComponent(url)}`}
      >
        X
      </a>
      <Button variant="text" onClick={copy} className="gap-2">
        {copied ? (
          <Check size={18} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Copy size={18} strokeWidth={1.5} aria-hidden="true" />
        )}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
