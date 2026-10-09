import { DateOnlySchema } from "@nakafa/aksara-contracts/date";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import {
  ARTICLE_PUBLICATION_CURSOR_PREFIX,
  encodeArticlePublicationCursor,
  hasArticlePublicationCursorPrefix,
} from "@repo/contents/publication";
import { encodeJsonText } from "@repo/utilities/json";
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
const PublicationCursorJsonSchema = Schema.fromJsonString(
  PublicationCursorSchema
);

/** Authenticates the position encoded by one non-empty public cursor. */
const readPublicationPosition = Effect.fn(
  "contentRelease.readPublicationPosition"
)(function* (cursor: string) {
  if (!hasArticlePublicationCursorPrefix(cursor)) {
    return yield* invalidCursor("unsupported format");
  }
  const payload = cursor.slice(ARTICLE_PUBLICATION_CURSOR_PREFIX.length);
  const key = yield* Schema.decodeEffect(PublicationCursorJsonSchema)(
    payload
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
    encodeJsonText([
      row.slot,
      row.appLocale,
      row.category,
      row.datePublished,
      row.contentKey,
    ])
  );
}

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
