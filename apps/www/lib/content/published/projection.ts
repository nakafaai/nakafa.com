import type { AppLocale } from "@nakafa/aksara-contracts/locale";
import { ArticleProjectionSchema } from "@nakafa/aksara-contracts/projection/article";
import { Effect, Schema } from "effect";
import { PublishedProjectionError } from "@/lib/content/published/errors";

interface PublishedProjectionIdentity {
  readonly appLocale: AppLocale;
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
    projection.appLocale !== identity.appLocale ||
    projection.publicPath !== identity.publicPath
  ) {
    return yield* new PublishedProjectionError(identity);
  }
  return projection;
});
