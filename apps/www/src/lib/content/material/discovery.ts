import type { Ref } from "@confect/core";
import "@tanstack/react-start/server-only";
import { ContentAuthorSchema } from "@nakafa/aksara-contracts/content";
import { PublicationDatesSchema } from "@nakafa/aksara-contracts/date";
import {
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect, Schema } from "effect";
import type { Locale } from "use-intl";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeContentRelease } from "@/lib/content/published/release";
import { queryPinnedContentStore } from "@/lib/content/store/query";

type MaterialSummary = Ref.Returns<
  typeof contentRelease.material.latest
>["materials"][number];
const PublishedMaterialSummarySchema = Schema.Struct({
  authors: Schema.Array(ContentAuthorSchema),
  ...PublicationDatesSchema.fields,
  description: Schema.optionalKey(Schema.String),
  publicPath: PublicPathSchema,
  sourcePath: CorpusSourcePathSchema,
  title: Schema.String,
});

/** Verified compact material metadata used by discovery surfaces. */
type PublishedMaterialSummary = typeof PublishedMaterialSummarySchema.Type;
/** Decodes one backend-verified material discovery row. */
const decodeMaterialSummary = Effect.fn("www.materials.decodeDiscovery")(
  function* (summary: MaterialSummary, locale: Locale) {
    const appLocale = AppLocaleSchema.make(locale);
    const [dates, publicPath, sourcePath] = yield* Effect.all([
      Schema.decodeEffect(PublicationDatesSchema)({
        ...(summary.dateModified === undefined
          ? {}
          : {
              dateModified: summary.dateModified,
            }),
        datePublished: summary.datePublished,
      }),
      Schema.decodeEffect(PublicPathSchema)(summary.publicPath),
      Schema.decodeEffect(CorpusSourcePathSchema)(summary.sourcePath),
    ]).pipe(
      Effect.mapError(
        () =>
          new PublishedProjectionError({
            appLocale,
            publicPath: summary.publicPath,
          })
      )
    );
    return {
      authors: summary.authors,
      ...dates,
      ...(summary.description === undefined
        ? {}
        : {
            description: summary.description,
          }),
      publicPath,
      sourcePath,
      title: summary.title,
    } satisfies PublishedMaterialSummary;
  }
);
/** Reads one complete published material partition for agent discovery. */
export const readPublishedMaterialBucket = Effect.fn(
  "www.materials.readBucket"
)(function* (locale: Locale, bucket: string, release?: ActiveContentReleaseId) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* queryPinnedContentStore(
    release,
    contentRelease.material.bucket,
    {
      appLocale,
      bucket,
    }
  );
  const activeReleaseId = yield* decodeContentRelease(result.activeReleaseId, {
    appLocale,
    publicPath: "materials",
  });
  if (!result.managed || activeReleaseId === null) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: "materials",
    });
  }
  if (result.materials === null) {
    return {
      activeReleaseId,
      materials: null,
    };
  }
  const materials = yield* Effect.forEach(result.materials, (summary) =>
    decodeMaterialSummary(summary, locale)
  );
  return {
    activeReleaseId,
    materials,
  };
});
/** Reads a bounded newest-first material set for feed discovery. */
export const readPublishedLatestMaterials = Effect.fn(
  "www.materials.readLatest"
)(function* (locale: Locale, limit: number, release?: ActiveContentReleaseId) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* queryPinnedContentStore(
    release,
    contentRelease.material.latest,
    {
      appLocale,
      limit,
    }
  );
  const activeReleaseId = yield* decodeContentRelease(result.activeReleaseId, {
    appLocale,
    publicPath: "materials",
  });
  if (!result.managed || activeReleaseId === null) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: "materials",
    });
  }
  const materials = yield* Effect.forEach(result.materials, (summary) =>
    decodeMaterialSummary(summary, locale)
  );
  return {
    activeReleaseId,
    materials,
  };
});
