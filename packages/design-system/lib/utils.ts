import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Resolves conditional classes and lets later Tailwind utilities win conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
