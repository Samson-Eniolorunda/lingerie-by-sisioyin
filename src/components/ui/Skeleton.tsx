import { cn } from "@/lib/cn";

export function Skeleton({ className }: { readonly className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-sm bg-tint", className)} />;
}
