import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import { ArticleProjectionSchema } from "@nakafa/aksara-contracts/projection/article";
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
