import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { PublicContentRouteSchema } from "@repo/contents/_types/route/schema";
import { Effect, Schema } from "effect";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** Adapts one exact Aksara projection to Nakafa's material route contract. */
export const decodePublishedRoute = Effect.fn(
  "NakafaContent.decodePublishedRoute"
)(function* (
  input: unknown,
  identity: { readonly locale: "en" | "id"; readonly publicPath: string }
) {
  const projection = yield* Schema.decodeUnknown(
    MaterialLessonProjectionSchema
  )(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError(() => new PublishedProjectionError(identity))
  );

  return yield* Schema.decodeUnknown(PublicContentRouteSchema)(
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
});
