import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { MATERIAL_SITEMAP_BUCKET_LIMIT } from "@repo/backend/confect/contentRelease/material/limits";
import { Array as Arr, Effect, Record as Rec, Schema } from "effect";
import {
  readPublishedMaterialBuckets,
  readPublishedMaterialSitemap,
} from "@/lib/content/material/sitemap";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** The locales whose lessons had the retired subject namespace (`/{locale}/subject/...`). */
export const SubjectLocaleSchema = Schema.Literals(["en", "id"]);

/** A locale whose retired subject lessons redirect to their successors. */
export type SubjectLocale = typeof SubjectLocaleSchema.Type;

/**
 * The successors of one locale's retired subject lessons: the public path of each
 * lesson in the active release, without the locale, by its content key.
 */
export const SubjectMapJson = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.String)
);

/** The static asset that holds one locale's map: the build writes it, and the Worker reads it. */
export function subjectMapPath(locale: SubjectLocale) {
  return `/_moved/subject/${locale}.json`;
}

/**
 * Reads every lesson of one locale's active release, as the material sitemap
 * lists it, and encodes the locale's map as the text of its asset.
 */
export const readSubjectMap = Effect.fn("www.routing.subject.map")(function* (
  locale: SubjectLocale
) {
  const { buckets } = yield* readPublishedMaterialBuckets(locale);
  const pages = yield* Effect.forEach(
    Arr.chunksOf(buckets, MATERIAL_SITEMAP_BUCKET_LIMIT),
    (batch) => readPublishedMaterialSitemap(locale, batch),
    { concurrency: 2 }
  );
  const routes = yield* Effect.forEach(pages, (page) =>
    page === null
      ? Effect.fail(
          new PublishedProjectionError({
            appLocale: AppLocaleSchema.make(locale),
            publicPath: subjectMapPath(locale),
          })
        )
      : Effect.succeed(page.routes)
  );
  const map = Rec.fromEntries(
    Arr.map(Arr.flatten(routes), ({ contentKey, publicPath }) => [
      contentKey,
      publicPath,
    ])
  );
  return {
    path: subjectMapPath(locale).slice(1),
    text: yield* Schema.encodeEffect(SubjectMapJson)(map),
  };
});
