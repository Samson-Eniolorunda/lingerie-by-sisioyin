"use client";

import Link from "next/link";
import { CATEGORY_LINKS, NAV, SUPPORT_LINKS } from "@/config/site";
import { Sheet } from "@/components/ui/Sheet";
import { ThemeControl } from "@/features/theme/ThemeControl";
import { useShell } from "./ShellContext";

const link = "flex min-h-12 items-center text-base text-ink no-underline hover:text-primary";

export function MenuSheet() {
  const shell = useShell();
  return (
    <Sheet
      side="left"
      open={shell.panel === "menu"}
      onOpenChange={(next) => (next ? shell.open("menu") : shell.close())}
      title="Menu"
    >
      <nav aria-label="Menu" className="flex flex-col gap-6">
        <ul>
          <li>
            <Link href="/" onClick={shell.close} className={link}>
              Home
            </Link>
          </li>
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={shell.close} className={link}>
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/shop?is_new=true" onClick={shell.close} className={link}>
              New arrivals
            </Link>
          </li>
        </ul>
        <div>
          <h2 className="text-sm font-medium tracking-wider text-subtle uppercase">Collections</h2>
          <ul className="mt-1">
            {CATEGORY_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={shell.close} className={link}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium tracking-wider text-subtle uppercase">Help</h2>
          <ul className="mt-1">
            {SUPPORT_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={shell.close} className={link}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium tracking-wider text-subtle uppercase">Theme</h2>
          <ThemeControl />
        </div>
      </nav>
    </Sheet>
  );
}
