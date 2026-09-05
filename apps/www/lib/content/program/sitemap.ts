import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  readProgramBuckets,
  readProgramSitemap,
} from "@repo/backend/content/program/sitemap";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

/** Reads non-empty curriculum sitemap partitions for one locale. */
export const readPublishedProgramBuckets = Effect.fn(
  "www.programs.readSitemapBuckets"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  return yield* readRuntimeQuery(
    api.contentRelease.program.sitemapBuckets,
    {
      appLocale,
    },
    (queryArgs) => readProgramBuckets(queryArgs.appLocale)
  );
});

/** Reads one complete verified curriculum sitemap partition. */
export const readPublishedProgramSitemap = Effect.fn(
  "www.programs.readSitemapPage"
)(function* (locale: Locale, bucket: string) {
  const appLocale = AppLocaleSchema.make(locale);
  return yield* readRuntimeQuery(
    api.contentRelease.program.sitemapPage,
    {
      appLocale,
      bucket,
    },
    (queryArgs) => readProgramSitemap(queryArgs.appLocale, queryArgs.bucket)
  );
});
