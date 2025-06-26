import { treaty } from "@elysiajs/eden";
import type { App } from ".";

const baseUrl =
  process.env.NODE_ENV === "production"
    ? "https://api.nakafa.com"
    : "http://localhost:3002";

export const createClient = (options?: { baseUrl?: string }) => {
  const url = options?.baseUrl ?? baseUrl;
  return treaty<App>(url);
};

export const client = createClient();

export type ApiClient = ReturnType<typeof createClient>;
