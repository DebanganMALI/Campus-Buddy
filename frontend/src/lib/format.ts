import type { AudienceDTO } from "../api/types";

const LOCALE = "en-IN";

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });

export const formatWeekday = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { weekday: "long" });

export function monthDay(iso: string): { m: string; d: string } {
  const date = new Date(iso);
  return { m: date.toLocaleDateString(LOCALE, { month: "short" }), d: String(date.getDate()) };
}

/** "Today", "Yesterday", "3 days ago", or a date. */
export function relativeDay(iso: string): string {
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return formatDate(iso);
}
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileKind(mime: string): "pdf" | "docx" | "pptx" | "file" {
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime.includes("presentationml")) return "pptx";
  return "file";
}

/** "CSE + IT, Years 3 & 4", "All departments, Year 3" or "Everyone". */
export function audienceLabel(a: AudienceDTO): string {
  const allD = (a.departments as string[]).includes("ALL");
  const allY = (a.years as Array<number | string>).includes("ALL");
  if (allD && allY) return "Everyone";
  const depts = allD ? "All departments" : (a.departments as string[]).join(" + ");
  const ys = a.years as number[];
  const years = allY ? "all years" : ys.length === 1 ? `Year ${ys[0]}` : `Years ${ys.slice(0, -1).join(", ")} & ${ys[ys.length - 1]}`;
  return `${depts}, ${years}`;
}

/** "for everyone", "for all departments, Year 3", "for CSE, Year 3" — for use after a verb or "For". */
export function forAudience(a: AudienceDTO): string {
  const l = audienceLabel(a);
  return l.startsWith("All ") || l === "Everyone" ? l.charAt(0).toLowerCase() + l.slice(1) : l;
}

/** Short day + month for list rows: { d: "9", m: "Nov" } */
export const dayMonth = (iso: string) => monthDay(iso);

export const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  faculty: "Faculty",
  moderator: "Moderator",
  placement_officer: "Placement officer",
  admin: "Admin",
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Days until a deadline, rounded up. Negative = closed. */
export const daysUntil = (iso: string) => Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);

/** For <input type="datetime-local">: ISO → local "YYYY-MM-DDTHH:mm" and back. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : "");
