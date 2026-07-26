import "server-only";

import { DateOnlySchema } from "@nakafa/aksara-contracts/date";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

type MaterialSummary = FunctionReturnType<
  typeof api.contentRelease.material.latest
>["materials"][number];

/** Verified compact material metadata used by discovery surfaces. */
export interface PublishedMaterialSummary {
  readonly authors: readonly { readonly name: string }[];
  readonly date: typeof DateOnlySchema.Type;
  readonly description: string | undefined;
  readonly publicPath: typeof PublicPathSchema.Type;
  readonly title: string;
}

/** Decodes one backend-verified material discovery row. */
const decodeMaterialSummary = Effect.fn("www.materials.decodeDiscovery")(
  function* (summary: MaterialSummary, locale: Locale) {
    const [date, publicPath] = yield* Effect.all([
      Schema.decodeUnknown(DateOnlySchema)(summary.date),
      Schema.decodeUnknown(PublicPathSchema)(summary.publicPath),
    ]).pipe(
      Effect.mapError(
        () =>
          new PublishedProjectionError({
            locale,
            publicPath: summary.publicPath,
          })
      )
    );
    return {
      authors: summary.authors,
      date,
      description: summary.description,
      publicPath,
      title: summary.title,
    } satisfies PublishedMaterialSummary;
  }
);

/** Reads one complete published material partition for agent discovery. */
export const readPublishedMaterialBucket = Effect.fn(
  "www.materials.readBucket"
)(function* (locale: Locale, bucket: string) {
  const result = yield* readRuntimeQuery("contentRelease.material.bucket", () =>
    fetchRuntimeQuery(api.contentRelease.material.bucket, { bucket, locale })
  );
  if (result.materials === null) {
    return { managed: result.managed, materials: null };
  }
  const materials = yield* Effect.forEach(result.materials, (summary) =>
    decodeMaterialSummary(summary, locale)
  );
  return { managed: result.managed, materials };
});

/** Reads a bounded newest-first material set for feed discovery. */
export const readPublishedLatestMaterials = Effect.fn(
  "www.materials.readLatest"
)(function* (locale: Locale, limit: number) {
  const result = yield* readRuntimeQuery("contentRelease.material.latest", () =>
    fetchRuntimeQuery(api.contentRelease.material.latest, { limit, locale })
  );
  const materials = yield* Effect.forEach(result.materials, (summary) =>
    decodeMaterialSummary(summary, locale)
  );
  return { managed: result.managed, materials };
});
