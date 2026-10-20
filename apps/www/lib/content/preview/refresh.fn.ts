import { createServerFn } from "@tanstack/react-start";

/**
 * Reads the local preview revision for the root document, on the server. The
 * root route loads it once per document, and its loader data stays for the page's
 * life, so a client navigation never calls it again.
 */
export const readPreviewRefreshFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { readPreviewRefreshHandler } = await import(
      "@/lib/content/preview/refresh.server"
    );
    return readPreviewRefreshHandler();
  }
);
