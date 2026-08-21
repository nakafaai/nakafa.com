import "server-only";
import {
  ContentKeySchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  MaterialKeySchema,
  MaterialSectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { applyPublishedCatalogCache } from "@/lib/content/cache";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

const TRUST_CONTENT_KEY = ContentKeySchema.make(
  "material/lesson/mathematics/exponential-logarithm/basic-concept"
);
const TRUST_MATERIAL_KEY = MaterialKeySchema.make(
  "lesson.mathematics.exponential-logarithm"
);
const TRUST_SECTION_KEY = MaterialSectionSchema.make("basic-concept");
/** Localized links resolved from the signed trust lesson projection. */
export interface PublishedTrustLesson {
  readonly lessonHref: string;
  readonly sourceHref: string;
}
/** Resolves exactly one current localized route for the stable trust lesson. */
export const readPublishedTrustLesson = Effect.fn(
  "www.marketing.readTrustLesson"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const args = {
    appLocale,
    contentKey: TRUST_CONTENT_KEY,
    expectedMaterialKey: TRUST_MATERIAL_KEY,
    expectedSectionKey: TRUST_SECTION_KEY,
  } satisfies FunctionArgs<typeof api.contentRelease.material.identity>;
  const result = yield* readRuntimeQuery(
    api.contentRelease.material.identity,
    args
  );
  if (!result.managed || result.publicPath === null) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: "marketing/trust",
    });
  }
  const publicPath = yield* Schema.decodeEffect(PublicPathSchema)(
    result.publicPath
  ).pipe(
    Effect.mapError(
      () =>
        new PublishedProjectionError({
          appLocale,
          publicPath: "marketing/trust",
        })
    )
  );
  const lessonHref = `/${locale}/${publicPath}`;
  return {
    lessonHref,
    sourceHref: `${lessonHref}.md`,
  } satisfies PublishedTrustLesson;
});
/** Caches the signed trust lesson links under content release invalidation. */
export async function getPublishedTrustLesson(locale: Locale) {
  "use cache";
  const lesson = await Effect.runPromise(readPublishedTrustLesson(locale));
  applyPublishedCatalogCache("material");
  return lesson;
}
