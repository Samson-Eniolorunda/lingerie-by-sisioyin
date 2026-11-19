import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageActions } from "@/features/admin/MessageThread";
import { PageHeader } from "@/features/admin/PageHeader";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Message" };
export const dynamic = "force-dynamic";

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff("messages.manage", `/admin/messages/${id}`);
  const message = await data.admin.message(id);
  if (!message) notFound();
  const thread = [
    {
      id: "first",
      from: "customer" as const,
      author: message.name,
      body: message.body,
      at: message.receivedAt,
    },
    ...message.replies.map((r) => ({
      id: r.id,
      from: r.from,
      author: r.author,
      body: r.body,
      at: r.sentAt,
    })),
  ];
  return (
    <>
      <p className="mb-2">
        <Link href="/admin/messages" className="inline-flex min-h-11 items-center text-sm">
          ← Messages
        </Link>
      </p>
      <PageHeader
        title={message.subject || "Message"}
        lead={`${message.name} · ${message.email}${message.phone ? ` · ${message.phone}` : ""}${message.orderNumber ? ` · Order ${message.orderNumber}` : ""}`}
      />
      <ol className="flex flex-col gap-3">
        {thread.map((t) => (
          <li
            key={t.id}
            className={`max-w-[42rem] border p-4 ${t.from === "staff" ? "self-end border-primary/30 bg-selected" : "border-line bg-surface"}`}
          >
            <p className="text-sm text-muted">
              {t.from === "staff" ? `You (${t.author})` : t.author} · {formatDateTime(t.at)}
            </p>
            <p className="mt-1 text-base whitespace-pre-wrap">{t.body}</p>
          </li>
        ))}
      </ol>
      <MessageActions
        id={message.id}
        status={message.status}
        canManage={can(user.role, "messages.manage")}
      />
    </>
  );
}
