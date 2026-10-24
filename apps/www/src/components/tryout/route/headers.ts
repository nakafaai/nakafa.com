import { PUBLIC_CONTENT_HEADERS } from "@/lib/content/delivery";

/**
 * The response headers of a public catalog page. Its document holds no
 * learner's progress, so the CDN keeps it for the lifetime its Cache-Control names.
 */
export function readTryoutCatalogHeaders() {
  return PUBLIC_CONTENT_HEADERS;
}

/**
 * The response headers of a try-out page that holds one learner's progress, such
 * as a track's set list or an attempt. No cache keeps it, so a shared cache never
 * serves one learner's document to another.
 */
export function readTryoutPersonalHeaders() {
  return { "Cache-Control": "private, no-store" };
}
