const TZ = "Africa/Lagos";

const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: TZ });
const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TZ,
});

export const formatDate = (iso: string): string => dateOnly.format(new Date(iso));
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));

/** "5 minutes ago", "3 hours ago", "2 days ago", then the date. */
export function relativeTime(iso: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}
