import type { AppLocale } from "@nakafa/aksara-contracts/locale";
import { ArticleProjectionSchema } from "@nakafa/aksara-contracts/projection/article";
import { PublicPageProjectionSchema } from "@nakafa/aksara-contracts/projection/page";
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
  const projection = yield* Schema.decodeUnknownEffect(ArticleProjectionSchema)(
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

/** Decodes one exact Page projection selected by its public identity. */
export const decodePublishedPage = Effect.fn(
  "NakafaContent.decodePublishedPage"
)(function* (input: unknown, identity: PublishedProjectionIdentity) {
  const projection = yield* Schema.decodeUnknownEffect(
    PublicPageProjectionSchema
  )(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError(() => new PublishedProjectionError(identity))
  );
  if (
    projection.appLocale !== identity.appLocale ||
    projection.publicPath !== identity.publicPath
  ) {
    return yield* new PublishedProjectionError(identity);
  }
  return projection;
});

/** Parses one canonical Page projection returned by the bounded catalog. */
export const decodePublishedPageJson = Effect.fn(
  "NakafaContent.decodePublishedPageJson"
)(function* (source: string, identity: PublishedProjectionIdentity) {
  const input = yield* Effect.try({
    catch: () => new PublishedProjectionError(identity),
    try: (): unknown => JSON.parse(source),
  });
  return yield* Schema.decodeUnknownEffect(PublicPageProjectionSchema)(input, {
    onExcessProperty: "error",
  }).pipe(Effect.mapError(() => new PublishedProjectionError(identity)));
});
