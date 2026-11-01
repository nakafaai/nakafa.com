import { PUBLIC_CONTENT_HEADERS } from "@/lib/content/delivery";

/**
 * The response headers of a public catalog page. Its document holds no
 * learner's progress, so the CDN keeps it for the lifetime its Cache-Control names.
 */
export function readTryoutCatalogHeaders() {
  return PUBLIC_CONTENT_HEADERS;
}
