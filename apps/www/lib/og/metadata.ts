import { HttpClient } from "@confect/js";
import { ContentAuthorSchema } from "@nakafa/aksara-contracts/content";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { resolveReferenceInput } from "@repo/backend/confect/contentRelease/reference/input";
import { contentSearchSummaryValidator } from "@repo/backend/confect/contents/search/schema";
import { Array as Arr, Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { applyContentCache } from "@/lib/content/cache";
import { httpLayer } from "@/lib/convex/http";

/** Expected failure raised when route metadata translations cannot be loaded. */
class TranslationLoadError extends Schema.TaggedError<TranslationLoadError>()(
  "TranslationLoadError",
  {
    locale: Schema.String,
    namespace: Schema.String,
  }
) {}
/** Route metadata: title and description are the Convex reference summary
 * fields, while authors and date have no Convex source. */
const SystemMetadataSchema = Schema.Struct({
  authors: Schema.Array(ContentAuthorSchema),
  date: Schema.String,
  description: Schema.optionalKey(
    contentSearchSummaryValidator.fields.description
  ),
  title: contentSearchSummaryValidator.fields.title,
});
type SystemMetadata = typeof SystemMetadataSchema.Type;

/** Gets SEO metadata from the Convex route catalog with translation defaults. */
export const getMetadataFromSlug = Effect.fn("www.metadata.readFromSlug")(
  function* (locale: Locale, slug: string[]) {
    const [tCommon, tMetadata] = yield* Effect.all(
      [
        Effect.tryPromise({
          try: () =>
            getTranslations({
              locale,
              namespace: "Common",
            }),
          catch: () =>
            new TranslationLoadError({
              namespace: "Common",
              locale,
            }),
        }),
        Effect.tryPromise({
          try: () =>
            getTranslations({
              locale,
              namespace: "Metadata",
            }),
          catch: () =>
            new TranslationLoadError({
              namespace: "Metadata",
              locale,
            }),
        }),
      ],
      {
        concurrency: "unbounded",
      }
    );
    const defaultTitle = tCommon("made-with-love");
    const shortDescription = tMetadata("short-description");
    const defaultMetadata: SystemMetadata = {
      title: defaultTitle,
      description: shortDescription,
      authors: [
        {
          name: "Nakafa",
        },
      ],
      date: "",
    };
    const reference = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(contentRelease.reference.read, {
        input: {
          appLocale: locale,
          kind: "route",
          publicPath: Arr.join(slug, "/"),
        },
      })
    ).pipe(Effect.provide(httpLayer()));
    if (!reference) {
      return defaultMetadata;
    }
    return {
      ...defaultMetadata,
      description: reference.description ?? shortDescription,
      title: reference.title || defaultTitle,
    };
  }
);

/** Resolves metadata inside a Cache Components-safe helper for OG routes. */
export async function getCachedMetadataFromSlug(
  locale: Locale,
  slug: string[]
) {
  "use cache";

  return await Effect.runPromise(
    Effect.gen(function* () {
      const reference = yield* resolveReferenceInput({
        appLocale: locale,
        kind: "route",
        publicPath: Arr.join(slug, "/"),
      });
      if (reference) {
        yield* Effect.sync(() => applyContentCache(reference.family));
      }
      return yield* getMetadataFromSlug(locale, slug);
    })
  );
}
