import { api } from "@repo/backend/convex/_generated/api";
import type { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

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
export function getMetadataFromSlug(
  locale: Locale,
  slug: string[]
): Effect.Effect<
  SystemMetadata,
  NakafaAgentDataReadError | TranslationLoadError
> {
  return Effect.gen(function* () {
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

    const reference = yield* readRuntimeQuery(
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
  });
}

/** Resolves metadata inside a Cache Components-safe helper for OG routes. */
export async function getCachedMetadataFromSlug(
  locale: Locale,
  slug: string[]
) {
  "use cache";

  applyContentRuntimeCache();

  return await Effect.runPromise(getMetadataFromSlug(locale, slug));
}
