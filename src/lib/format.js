const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function toDate(value) {
  if (!value) return null;
  // Plain YYYY-MM-DD values are calendar dates, not instants.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? dateFormat.format(date) : "";
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? dateTimeFormat.format(date) : "";
}

export function formatTime(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return value || "";
  const [h, m] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(value) {
  const date = toDate(value);
  if (!date) return "";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** Rupee amount stored as a plain number string, e.g. "2500000" → "₹25,00,000". */
export function formatAmount(value) {
  return value === "" || value == null || Number.isNaN(Number(value)) ? "" : inr.format(Number(value));
}

export function plural(count, word, pluralWord = `${word}s`) {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

/** Only render http(s) links; anything else is shown as text. */
export function safeUrl(value) {
  return /^https?:\/\//i.test(value || "") ? value : null;
}
