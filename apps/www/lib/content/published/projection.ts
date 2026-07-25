import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import { ArticleProjectionSchema } from "@nakafa/aksara-contracts/projection/article";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { PublicContentRouteSchema } from "@repo/contents/_types/route/schema";
import { Effect, Schema } from "effect";
import { PublishedProjectionError } from "@/lib/content/published/errors";

interface PublishedProjectionIdentity {
  readonly locale: ContentLocale;
  readonly publicPath: string;
}

/** Decodes one exact article projection selected by its public identity. */
export const decodePublishedArticle = Effect.fn(
  "NakafaContent.decodePublishedArticle"
)(function* (input: unknown, identity: PublishedProjectionIdentity) {
  const projection = yield* Schema.decodeUnknown(ArticleProjectionSchema)(
    input,
    { onExcessProperty: "error" }
  ).pipe(Effect.mapError(() => new PublishedProjectionError(identity)));
  if (
    projection.locale !== identity.locale ||
    projection.publicPath !== identity.publicPath
  ) {
    return yield* new PublishedProjectionError(identity);
  }
  return projection;
});

/** Decodes one exact material projection and adapts its Nakafa route. */
export const decodePublishedMaterial = Effect.fn(
  "NakafaContent.decodePublishedMaterial"
)(function* (input: unknown, identity: PublishedProjectionIdentity) {
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
