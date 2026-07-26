import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Reads non-empty curriculum sitemap partitions for one locale. */
export const readPublishedProgramBuckets = Effect.fn(
  "www.programs.readSitemapBuckets"
)(function* (locale: Locale) {
  return yield* readRuntimeQuery("contentRelease.program.sitemapBuckets", () =>
    fetchRuntimeQuery(api.contentRelease.program.sitemapBuckets, { locale })
  );
});

/** Reads one complete verified curriculum sitemap partition. */
export const readPublishedProgramSitemap = Effect.fn(
  "www.programs.readSitemapPage"
)(function* (locale: Locale, bucket: string) {
  return yield* readRuntimeQuery("contentRelease.program.sitemapPage", () =>
    fetchRuntimeQuery(api.contentRelease.program.sitemapPage, {
      bucket,
      locale,
    })
  );
});
