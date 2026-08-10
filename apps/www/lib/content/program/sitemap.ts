import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

/** Reads non-empty curriculum sitemap partitions for one locale. */
export const readPublishedProgramBuckets = Effect.fn(
  "www.programs.readSitemapBuckets"
)(function* (locale: Locale) {
  return yield* readRuntimeQuery(api.contentRelease.program.sitemapBuckets, {
    locale,
  });
});

/** Reads one complete verified curriculum sitemap partition. */
export const readPublishedProgramSitemap = Effect.fn(
  "www.programs.readSitemapPage"
)(function* (locale: Locale, bucket: string) {
  return yield* readRuntimeQuery(api.contentRelease.program.sitemapPage, {
    bucket,
    locale,
  });
});
