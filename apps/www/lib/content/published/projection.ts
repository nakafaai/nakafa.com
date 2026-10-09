import { ArticleProjectionSchema } from "@nakafa/aksara-contracts/projection/article";
import { PublicPageProjectionSchema } from "@nakafa/aksara-contracts/projection/page";
import { Effect, Schema } from "effect";
import {
  PublishedProjectionError,
  type PublishedProjectionIdentity,
} from "@/lib/content/published/errors";

/** Decodes one exact article projection selected by its public identity. */
export const decodePublishedArticle = Effect.fn(
  "NakafaContent.decodePublishedArticle"
)(function* (input: unknown, identity: PublishedProjectionIdentity) {
  const projection = yield* Schema.decodeUnknownEffect(ArticleProjectionSchema)(
    input,
    { onExcessProperty: "error" }
  ).pipe(Effect.mapError(() => PublishedProjectionError.make(identity)));
  if (
    projection.appLocale !== identity.appLocale ||
    projection.publicPath !== identity.publicPath
  ) {
    return yield* PublishedProjectionError.make(identity);
  }
  return projection;
});

/** Decodes one exact Page projection selected by its public identity. */
export const decodePublishedPage = Effect.fn(
  "NakafaContent.decodePublishedPage"
)(function* (input: unknown, identity: PublishedProjectionIdentity) {
  const projection = yield* Schema.decodeUnknownEffect(
    PublicPageProjectionSchema
  )(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError(() => PublishedProjectionError.make(identity))
  );
  if (
    projection.appLocale !== identity.appLocale ||
    projection.publicPath !== identity.publicPath
  ) {
    return yield* PublishedProjectionError.make(identity);
  }
  return projection;
});

/** Parses one canonical Page projection returned by the bounded catalog. */
export const decodePublishedPageJson = Effect.fn(
  "NakafaContent.decodePublishedPageJson"
)(function* (source: string, identity: PublishedProjectionIdentity) {
  return yield* Schema.decodeEffect(
    Schema.fromJsonString(PublicPageProjectionSchema)
  )(source, {
    onExcessProperty: "error",
  }).pipe(Effect.mapError(() => PublishedProjectionError.make(identity)));
});
