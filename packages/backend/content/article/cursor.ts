import { DateOnlySchema } from "@nakafa/aksara-contracts/date";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import {
  ARTICLE_PUBLICATION_CURSOR_PREFIX,
  encodeArticlePublicationCursor,
  hasArticlePublicationCursorPrefix,
} from "@repo/contents/_types/publication";
import { Effect, Schema } from "effect";

const publicationFields = [
  Schema.String,
  AppLocaleSchema,
  ArticleCategorySchema,
  DateOnlySchema,
  ContentKeySchema,
] as const;
const PublicationCursorSchema = Schema.Union([
  Schema.Tuple(publicationFields),
  Schema.Tuple([...publicationFields, Schema.Finite, Schema.String]),
]);

/** Authenticates the position encoded by one non-empty public cursor. */
const readPublicationPosition = Effect.fn(
  "contentRelease.readPublicationPosition"
)(function* (cursor: string) {
  if (!hasArticlePublicationCursorPrefix(cursor)) {
    return yield* invalidCursor("unsupported format");
  }
  const payload = cursor.slice(ARTICLE_PUBLICATION_CURSOR_PREFIX.length);
  const parsed = yield* Effect.try({
    try: (): unknown => JSON.parse(payload),
    catch: () => invalidCursorError("invalid position"),
  });
  const key = yield* Schema.decodeUnknownEffect(PublicationCursorSchema)(
    parsed
  ).pipe(Effect.mapError(() => invalidCursorError("invalid position")));
  return key;
});

/** Decodes the first-page sentinel or one stable publication position. */
export const decodePublicationPosition = Effect.fn(
  "contentRelease.decodePublicationPosition"
)(function* (cursor: string | null) {
  if (cursor === null) {
    return null;
  }
  return yield* readPublicationPosition(cursor);
});

/** Encodes the unique article identity without database-generated fields. */
export function articlePublicationCursor(
  row: PublicationRow<"articleCatalog">
) {
  return encodeArticlePublicationCursor(
    JSON.stringify([
      row.slot,
      row.appLocale,
      row.category,
      row.datePublished,
      row.contentKey,
    ])
  );
}

/** Converts a stream split position to the portable public identity. */
export const portablePublicationCursor = Effect.fn(
  "contentRelease.portablePublicationCursor"
)(function* (nativeCursor: string) {
  if (nativeCursor === "[]") {
    return encodeArticlePublicationCursor(nativeCursor);
  }
  const key = yield* readPublicationPosition(
    encodeArticlePublicationCursor(nativeCursor)
  );
  const [slot, appLocale, category, datePublished, contentKey] = key;
  return encodeArticlePublicationCursor(
    JSON.stringify([slot, appLocale, category, datePublished, contentKey])
  );
});

/** Creates one typed publication cursor failure. */
function invalidCursor(reason: string) {
  return Effect.fail(invalidCursorError(reason));
}

/** Creates one stable cursor integrity error. */
function invalidCursorError(reason: string) {
  return new ReleaseError({
    code: "CONTENT_RELEASE_INTEGRITY",
    message: `Article publication cursor has an ${reason}.`,
  });
}
