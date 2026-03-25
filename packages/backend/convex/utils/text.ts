/** Convert text into a URL-friendly slug. */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Truncate text for previews while preserving whole trimmed words where possible. */
export function truncateText({
  text,
  maxLength = 200,
}: {
  text: string;
  maxLength?: number;
}) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}…`;
}
