import "server-only";
import {
  ContentKeySchema,
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  MaterialKeySchema,
  MaterialSectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { readMaterialIdentity } from "@repo/backend/content/material/identity";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { applyPublishedContentCache } from "@/lib/content/cache";
import {
  PublishedProjectionError,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";
import {
  type PublishedMaterialContent,
  readRenderedMaterial,
} from "@/lib/content/published/material";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

const TRUST_CONTENT_KEY = ContentKeySchema.make(
  "material/lesson/mathematics/trigonometry/right-triangle-naming"
);
const TRUST_MATERIAL_KEY = MaterialKeySchema.make(
  "lesson.mathematics.trigonometry"
);
const TRUST_SECTION_KEY = MaterialSectionSchema.make("right-triangle-naming");
const TrustIdentitySchema = Schema.Struct({
  activeReleaseId: ReleaseIdSchema,
  publicPath: PublicPathSchema,
});
/** One complete signed lesson rendered beside its exact authored MDX. */
export interface PublishedTrustLesson
  extends Pick<PublishedMaterialContent, "artifactHash" | "body" | "rawMdx"> {
  readonly lessonHref: string;
  readonly sourceHref: string;
}
/** Resolves and renders the curated lesson from one current publication. */
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
    args,
    (queryArgs) => readMaterialIdentity(queryArgs)
  );
  if (!result.managed || result.publicPath === null) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: "marketing/trust",
    });
  }
  const identity = yield* Schema.decodeEffect(TrustIdentitySchema)(result).pipe(
    Effect.mapError(
      () =>
        new PublishedProjectionError({
          appLocale,
          publicPath: "marketing/trust",
        })
    )
  );
  const published = yield* readRenderedMaterial({
    appLocale,
    publicPath: identity.publicPath,
  });
  if (published.activeReleaseId !== identity.activeReleaseId) {
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: published.activeReleaseId,
      expectedReleaseId: identity.activeReleaseId,
    });
  }
  const lessonHref = `/${locale}/${identity.publicPath}`;
  return {
    artifactHash: published.artifactHash,
    body: published.body,
    lessonHref,
    rawMdx: published.rawMdx,
    sourceHref: `${lessonHref}.md`,
  } satisfies PublishedTrustLesson;
});
/** Caches the complete comparison under release and artifact invalidation. */
export async function getPublishedTrustLesson(locale: Locale) {
  "use cache";
  const lesson = await Effect.runPromise(readPublishedTrustLesson(locale));
  applyPublishedContentCache("material", lesson.artifactHash);
  return lesson;
}
