import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const URL_REGEX = /^https?:\/\//i;

export function formatUrl(link: string): string {
  const url = link.trim();
  if (!URL_REGEX.test(url)) {
    return `https://${url}`;
  }
  return url;
}

const URL_CLEANUP_REGEX = /(https?:\/\/)?(www\.)?/i;

export function cleanupUrl(url: string): string {
  return url.replace(URL_CLEANUP_REGEX, "");
}
