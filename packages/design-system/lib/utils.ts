import { type ClassValue, clsx } from "clsx";
import lookup from "country-code-lookup";
import { nanoid } from "nanoid";
import { Children, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

/**
 * Merges multiple class names
 * @param inputs - The class names to merge
 * @returns The merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const URL_REGEX = /^https?:\/\//i;

/**
 * Formats a URL
 * @param link - The URL to format
 * @returns The formatted URL
 */
export function formatUrl(link: string): string {
  const url = link.trim();
  if (!URL_REGEX.test(url)) {
    return `https://${url}`;
  }
  return url;
}

const URL_CLEANUP_REGEX = /(https?:\/\/)?(www\.)?/i;

/**
 * Removes the URL prefix from a string
 * @param url - The URL to remove the prefix from
 * @returns The URL without the prefix
 */
export function cleanupUrl(url: string): string {
  return url.replace(URL_CLEANUP_REGEX, "");
}

/**
 * Removes the leading slash from a string
 * @param path - The path to remove the leading slash from
 * @returns The path without a leading slash
 */
export function removeLeadingSlash(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

import { keys as coreKeys } from "@repo/next-config/keys";

/**
 * Gets the app URL
 * @returns The app URL, defaults to https://nakafa.com
 */
export function getAppUrl(): string {
  const { NEXT_PUBLIC_APP_URL } = coreKeys();
  return NEXT_PUBLIC_APP_URL ?? "https://nakafa.com";
}

/**
 * Slugifies a text
 * @param text - The text to slugify
 * @returns The slugified text, example: "Hello World" -> "hello-world"
 */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-");
}

export function createHeadingId(text: string): string {
  return slugify(createHeadingLabel(text));
}

export function createHeadingLabel(text: string): string {
  return text
    .replace(/<InlineMath[^>]*math="([^"]*)"[^>]*\/>/g, "$1")
    .replace(/<BlockMath[^>]*math="([^"]*)"[^>]*\/>/g, "$1")
    .replace(/<CodeBlock[^>]*\/>/g, "[Code]")
    .replace(/<[^>]*>/g, "")
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .trim();
}

/**
 * Filters whitespace text nodes from the given children to prevent hydration errors.
 * @param children - The children to filter.
 * @returns The filtered children.
 */
export function filterWhitespaceNodes(children: ReactNode) {
  return Children.toArray(children).filter(
    (child) => !(typeof child === "string" && child.trim() === "")
  );
}

/**
 * Saves a file to the browser
 * @param filename - The name of the file
 * @param content - The content of the file
 * @param mimeType - The MIME type of the file
 */
export function save(
  filename: string,
  content: string | Blob,
  mimeType: string
) {
  const blob =
    typeof content === "string"
      ? new Blob([content], { type: mimeType })
      : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Gets the country name from a country code
 * @param countryCode - The country code to get the name from
 * @returns The country name
 */
export function getCountryName(
  countryCode?: string | null
): string | undefined {
  if (!countryCode) {
    return;
  }
  try {
    const country = lookup.byIso(countryCode) || lookup.byFips(countryCode);
    return country ? country.country : countryCode;
  } catch {
    return countryCode;
  }
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
 * Formats a file size
 * @param bytes - The file size in bytes
 * @returns The formatted file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
