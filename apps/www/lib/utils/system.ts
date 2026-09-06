import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { api } from "@repo/backend/convex/_generated/api";
import { resolveReferenceInput } from "@repo/backend/convex/contentRelease/reference/input";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { env } from "@/env";
import { applyContentCache } from "@/lib/content/cache";

/** Expected failure raised when route metadata translations cannot be loaded. */
class TranslationLoadError extends Schema.TaggedError<TranslationLoadError>()(
  "TranslationLoadError",
  {
    locale: Schema.String,
    namespace: Schema.String,
  }
) {}

interface SystemMetadata {
  authors: { name: string }[];
  date: string;
  description?: string;
  title: string;
}

/** Gets SEO metadata from the Convex route catalog with translation defaults. */
export const getMetadataFromSlug = Effect.fn("www.metadata.readFromSlug")(
  function* (locale: Locale, slug: string[]) {
    const [tCommon, tMetadata] = yield* Effect.all(
      [
        Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "Common" }),
          catch: () =>
            new TranslationLoadError({ namespace: "Common", locale }),
        }),
        Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "Metadata" }),
          catch: () =>
            new TranslationLoadError({ namespace: "Metadata", locale }),
        }),
      ],
      { concurrency: "unbounded" }
    );

    const defaultTitle = tCommon("made-with-love");
    const shortDescription = tMetadata("short-description");
    const defaultMetadata: SystemMetadata = {
      title: defaultTitle,
      description: shortDescription,
      authors: [{ name: "Nakafa" }],
      date: "",
    };

    const reference = yield* readNakafaRuntimeQuery(
      env.NEXT_PUBLIC_CONVEX_URL,
      api.contentRelease.reference.read,
      {
        input: {
          appLocale: locale,
          kind: "route",
          publicPath: slug.join("/"),
        },
      }
    );

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
        publicPath: slug.join("/"),
      });
      if (reference) {
        yield* Effect.sync(() => applyContentCache(reference.family));
      }
      return yield* getMetadataFromSlug(locale, slug);
    })
  );
}
