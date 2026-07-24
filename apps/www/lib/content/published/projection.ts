import {
  type ArticleProjection,
  ArticleProjectionSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { PublicContentRouteSchema } from "@repo/contents/_types/route/schema";
import { Effect, Schema } from "effect";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** Decodes one exact article projection for the current public identity. */
export const decodePublishedArticle: (
  input: unknown,
  identity: { readonly locale: "en" | "id"; readonly publicPath: string }
) => Effect.Effect<ArticleProjection, PublishedProjectionError> = Effect.fn(
  "NakafaContent.decodePublishedArticle"
)(function* (
  input: unknown,
  identity: { readonly locale: "en" | "id"; readonly publicPath: string }
) {
  return yield* Schema.decodeUnknown(ArticleProjectionSchema)(input, {
    onExcessProperty: "error",
  }).pipe(Effect.mapError(() => new PublishedProjectionError(identity)));
});

/** Decodes one exact material projection and adapts its Nakafa route. */
export const decodePublishedMaterial = Effect.fn(
  "NakafaContent.decodePublishedMaterial"
)(function* (
  input: unknown,
  identity: { readonly locale: "en" | "id"; readonly publicPath: string }
) {
  const projection = yield* Schema.decodeUnknown(
    MaterialLessonProjectionSchema
  )(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError(() => new PublishedProjectionError(identity))
  );

  const route = yield* Schema.decodeUnknown(PublicContentRouteSchema)(
    {
      description: projection.metadata.description,
      kind: projection.kind,
      locale: projection.locale,
      materialKey: projection.materialKey,
      order: projection.order,
      parentPath: projection.parentPath,
      publicPath: projection.publicPath,
      sectionKey: projection.sectionKey,
      sitemap: projection.sitemap,
      sourcePath: projection.contentKey,
      title: projection.metadata.title,
    },
    { onExcessProperty: "error" }
  ).pipe(Effect.mapError(() => new PublishedProjectionError(identity)));
  return { projection, route };
});
