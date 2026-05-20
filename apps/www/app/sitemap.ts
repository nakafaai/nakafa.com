import { captureServerException } from "@repo/analytics/posthog/server";
import { Effect } from "effect";
import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/sitemap/entries";

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return Effect.runPromise(
    getSitemapEntries({
      reportError: (error, context) =>
        captureServerException(error, undefined, context),
    })
  );
}
