import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-sm font-medium tracking-[0.14em] text-subtle uppercase">Error 404</p>
      <h1 className="mt-2 font-display text-4xl">We could not find that page</h1>
      <p className="mt-3 text-base text-muted">It may have moved, or the link may be mistyped.</p>
      <div className="mt-8 flex justify-center gap-3">
        <ButtonLink href="/shop">Go to the shop</ButtonLink>
      </div>
    </div>
  );
}
