import {
  AppLocaleCodeSchema,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { ArticleProjectionSchema } from "@nakafa/aksara-contracts/projection/article";
import { Effect, Option, Schema } from "effect";
import { io } from "next/cache";
import {
  type ArticlePreviewContent,
  readArticlePreview,
} from "@/lib/content/preview/article";
import { hasPreviewConfig } from "@/lib/content/preview/config";

/** Exact route identity shared by metadata and body ownership reads. */
const ArticleContentInputSchema = Schema.Struct({
  locale: AppLocaleCodeSchema,
  publicPath: ArticleProjectionSchema.fields.publicPath,
});

export type ArticleContentInput = typeof ArticleContentInputSchema.Type;

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
export async function resolveArticleOwner(input: ArticleContentInput) {
  const preview = await readPreviewOwner(input);
  if (Option.isSome(preview)) {
    return { content: preview.value, kind: "preview" as const };
  }

  return { kind: "published" as const };
}
