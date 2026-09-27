import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import { env } from "@/env";
import "server-only";
import { PublicationDatesSchema } from "@nakafa/aksara-contracts/date";
import {
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";

type MaterialSummary = Ref.Returns<
  typeof refs.public.contentRelease.material.latest
>["materials"][number];
/** Verified compact material metadata used by discovery surfaces. */
export interface PublishedMaterialSummary {
  readonly authors: readonly {
    readonly name: string;
  }[];
  readonly dateModified?: Exclude<
    (typeof PublicationDatesSchema.Type)["dateModified"],
    undefined
  >;
  readonly datePublished: (typeof PublicationDatesSchema.Type)["datePublished"];
  readonly description?: string;
  readonly publicPath: typeof PublicPathSchema.Type;
  readonly sourcePath: typeof CorpusSourcePathSchema.Type;
  readonly title: string;
}
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
)(function* (
  locale: Locale,
  bucket: string,
  expectedActiveReleaseId?: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.material.bucket, {
      appLocale,
      bucket,
    })
  ).pipe(Effect.provide(HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL)));
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
)(function* (
  locale: Locale,
  limit: number,
  expectedActiveReleaseId?: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.material.latest, {
      appLocale,
      limit,
    })
  ).pipe(Effect.provide(HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL)));
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
