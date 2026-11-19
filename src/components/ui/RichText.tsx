import Link from "next/link";
import type { ContentNode } from "@/content/schema";
import { cn } from "@/lib/cn";

function Node({ node }: { readonly node: ContentNode }) {
  if (typeof node === "string") return <>{node}</>;
  const kids = node.c.map((child, i) => <Node key={i} node={child} />);
  switch (node.t) {
    case "p":
      return <p className="mt-3 first:mt-0">{kids}</p>;
    case "ul":
      return <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-subtle">{kids}</ul>;
    case "ol":
      return <ol className="mt-3 list-decimal space-y-2 pl-5 marker:text-subtle">{kids}</ol>;
    case "li":
      return <li>{kids}</li>;
    case "strong":
      return <strong className="font-semibold text-ink">{kids}</strong>;
    case "em":
      return <em>{kids}</em>;
    case "br":
      return <br />;
    case "h3":
      return <h3 className="mt-5 font-sans text-lg font-semibold text-ink">{kids}</h3>;
    case "h4":
      return <h4 className="mt-4 font-sans text-base font-semibold text-ink">{kids}</h4>;
    case "table":
      return (
        <table className="mt-3 w-full table-fixed border-collapse text-left text-sm sm:text-base">
          {kids}
        </table>
      );
    case "thead":
      return <thead className="border-b border-rule text-subtle">{kids}</thead>;
    case "tbody":
      return <tbody>{kids}</tbody>;
    case "tr":
      return <tr className="border-b border-line">{kids}</tr>;
    case "th":
      return <th className="px-1 py-2 font-medium">{kids}</th>;
    case "td":
      return <td className="tabular px-1 py-2 align-top">{kids}</td>;
    case "div":
      return (
        <div
          className={cn(node.callout && "mt-4 border-l-4 border-primary bg-primary-tint px-4 py-3")}
        >
          {kids}
        </div>
      );
    case "a": {
      const href = node.href ?? "";
      if (href.startsWith("/") || href.startsWith("#")) {
        return (
          <Link href={href} className="inline-block min-h-6 py-0.5">
            {kids}
          </Link>
        );
      }
      const safe = /^(https:|mailto:|tel:)/.test(href);
      return (
        <a
          href={safe ? href : "#"}
          {...(href.startsWith("https:") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="inline-block min-h-6 py-0.5"
        >
          {kids}
        </a>
      );
    }
  }
}

/** Renders validated content nodes as React elements. Only the allowed tags exist, so nothing is injected as HTML. */
export function RichText({
  nodes,
  className,
}: {
  readonly nodes: readonly ContentNode[];
  readonly className?: string;
}) {
  return (
    <div className={cn("text-base leading-relaxed text-muted", className)}>
      {nodes.map((node, i) => (
        <Node key={i} node={node} />
      ))}
    </div>
  );
}
