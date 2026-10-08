import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  AppLocaleCodeSchema,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
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
  publicPath: PublicPathSchema,
});
export type ArticleContentInput = typeof ArticleContentInputSchema.Type;

const PublishedOwnerSchema = Schema.Struct({
  kind: Schema.Literal("published"),
});
export type PublishedOwner = typeof PublishedOwnerSchema.Type;

/** Keeps the discriminant a literal type, so the owner union narrows on it. */
const previewKind = "preview" as const;

/** Wraps an authenticated preview. Its content holds React nodes, so no Schema describes it. */
function toPreviewOwner(content: ArticlePreviewContent) {
  return { content, kind: previewKind };
}
export type PreviewOwner = ReturnType<typeof toPreviewOwner>;

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
    return toPreviewOwner(preview.value);
  }

  return { kind: "published" };
}
