import { nanoid } from "nanoid";

/**
 * Generate a random id
 * @returns The generated id
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Clean a slug, remove slash at the beginning and the end
 * @param slug - The slug to clean, example: "/hello/world" -> "hello/world"
 * @returns The cleaned slug
 */
export function cleanSlug(slug: string): string {
  return slug.replace(/^\/+|\/+$/g, "");
}

/**
 * Slugifies a text
 * @param text - The text to slugify
 * @returns The slugified text, example: "Hello World" -> "hello-world"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove non-alphanumeric characters
    .replace(/[\s-]+/g, "-") // Replace spaces and dashes with a single dash
    .replace(/^-+|-+$/g, ""); // Remove leading and trailing dashes
}

/**
 * Generates a nanoid
 * @param length - The length of the nanoid
 * @returns The generated nanoid
 */
export function generateNanoId(length?: number): string {
  return nanoid(length ?? 10);
}

/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 * Used for reply previews (Discord-style).
 */
export function truncateText({
  text,
  maxLength = 200,
}: {
  text: string;
  maxLength?: number;
}): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trim()}…`;
}
