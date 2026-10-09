import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import "server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";
import { httpLayer } from "@/lib/convex/http";

/** Reads non-empty material sitemap partitions for one localized catalog. */
export const readPublishedMaterialBuckets = Effect.fn(
  "www.materials.readSitemapBuckets"
)(function* (locale: Locale, expectedActiveReleaseId?: ContentReleasePin) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.material.sitemapBuckets, {
      appLocale,
    })
  ).pipe(Effect.provide(httpLayer()));
  const activeReleaseId = yield* decodeContentReleasePin(
    result.activeReleaseId,
    expectedActiveReleaseId,
    {
      appLocale,
      publicPath: "materials",
    }
  );
  if (!result.managed || activeReleaseId === null) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: "sitemap.xml",
    });
  }
  return {
    activeReleaseId,
    buckets: result.buckets,
    materialCount: result.materialCount,
  };
});

/** Reads one complete verified material sitemap partition. */
export const readPublishedMaterialSitemap = Effect.fn(
  "www.materials.readSitemapPage"
)(function* (
  locale: Locale,
  bucket: Ref.Args<typeof contentRelease.material.sitemapPage>["bucket"]
) {
  const appLocale = AppLocaleSchema.make(locale);
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.material.sitemapPage, {
      appLocale,
      bucket,
    })
  ).pipe(Effect.provide(httpLayer()));
});
