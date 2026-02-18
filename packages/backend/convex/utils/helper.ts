import { ConvexError } from "convex/values";
import { nanoid } from "nanoid";

/**
 * Generate a cryptographically secure random UUID.
 * @returns UUID string (v4)
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Clean a slug by removing leading and trailing slashes.
 * @param slug - The slug to clean (e.g., "/hello/world/" -> "hello/world")
 * @returns The cleaned slug
 */
export function cleanSlug(slug: string): string {
  return slug.replace(/^\/+|\/+$/g, "");
}

/**
 * Clamp a number within an inclusive range.
 *
 * @param value - The number to clamp
 * @param min - Inclusive lower bound
 * @param max - Inclusive upper bound
 * @returns The clamped number
 */
export function clampNumber({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}): number {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.min(Math.max(value, low), high);
}

/**
 * Convert text into a URL-friendly slug.
 * Removes non-alphanumeric chars and replaces spaces with dashes.
 *
 * @param text - The text to slugify (e.g., "Hello World!" -> "hello-world")
 * @returns The slugified text
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
 * Generate a short, unique ID (NanoID).
 *
 * @param length - Length of the ID (default: 10)
 * @returns The generated NanoID
 */
export function generateNanoId(length?: number): string {
  return nanoid(length ?? 10);
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed.
 * Useful for previews or UI display limits.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum characters before truncation (default: 200)
 * @returns The truncated text with "..." if truncated
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

/**
 * Extract error message from any error type.
 * Handles ConvexError (extracts data.message), Error (uses message), and unknown types.
 *
 * @param error - The error to extract message from
 * @returns The error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string; code?: string };
    return data.message ?? JSON.stringify(data);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
