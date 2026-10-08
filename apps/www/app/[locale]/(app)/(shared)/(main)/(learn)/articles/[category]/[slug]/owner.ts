import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { ArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import { Effect, Option } from "effect";
import { io } from "next/cache";
import type { Locale } from "next-intl";
import {
  type ArticlePreviewContent,
  readArticlePreview,
} from "@/lib/content/preview/article";
import { hasPreviewConfig } from "@/lib/content/preview/config";

/** Exact route identity shared by metadata and body ownership reads. */
export interface ArticleContentInput {
  readonly locale: Locale;
  readonly publicPath: ArticleProjection["publicPath"];
}

export interface PublishedOwner {
  readonly kind: "published";
}

export interface PreviewOwner {
  readonly content: ArticlePreviewContent;
  readonly kind: "preview";
}

/** Reads local article ownership only inside the configured preview child. */
async function readPreviewOwner(input: ArticleContentInput) {
  if (!hasPreviewConfig()) {
    return Option.none<ArticlePreviewContent>();
  }

  await io();
  return Effect.runPromise(
    readArticlePreview({
      appLocale: AppLocaleSchema.make(input.locale),
      publicPath: input.publicPath,
    })
  );
}

/** Selects one exclusive article owner before any native module import. */
export async function resolveArticleOwner(
  input: ArticleContentInput
): Promise<PreviewOwner | PublishedOwner> {
  const preview = await readPreviewOwner(input);
  if (Option.isSome(preview)) {
    return { content: preview.value, kind: "preview" };
  }

  return { kind: "published" };
}
