import { captureServerException } from "@repo/analytics/posthog/server";
import { Effect } from "effect";
import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/sitemap/entries";
import { getSitemapPageDescriptors } from "@/lib/sitemap/routes";

/** Declares stable sitemap page ids without scanning content routes. */
export async function generateSitemaps() {
  const descriptors = await getSitemapPageDescriptors();

  return descriptors.map((descriptor) => ({
    id: descriptor.id,
  }));
}

/** Serves one bounded sitemap page from materialized Convex route rows. */
export default async function sitemap(props: {
  id?: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const pageId = await props.id;

  return Effect.runPromise(
    getSitemapEntries({
      pageId,
      reportError: (error, context) =>
        captureServerException(error, undefined, context),
    })
  );
}
