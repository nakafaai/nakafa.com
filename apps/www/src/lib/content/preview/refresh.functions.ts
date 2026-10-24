import { createServerFn } from "@tanstack/react-start";
import { Effect, Option } from "effect";

/**
 * Reads the local preview revision for the root document, on the server. The
 * root route loads it once per document, and its loader data stays for the page's
 * life, so a client navigation never calls it again.
 */
export const readPreviewRefreshFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { readPreviewRefresh } = await import(
      "@/lib/content/preview/refresh.server"
    );
    const { runServerEffect } = await import("@/lib/server/fn");
    // The undefined exists only at this serialization boundary.
    return runServerEffect(
      readPreviewRefresh().pipe(Effect.map(Option.getOrUndefined))
    );
  }
);
