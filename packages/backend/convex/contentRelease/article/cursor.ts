import { DateOnlySchema } from "@nakafa/aksara-contracts/date";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import {
  ARTICLE_PUBLICATION_CURSOR_PREFIX,
  encodeArticlePublicationCursor,
  hasArticlePublicationCursorPrefix,
} from "@repo/contents/_types/publication";
import { convexToJson } from "convex/values";
import { Effect, Schema } from "effect";

const PublicationCursorSchema = Schema.Tuple([
  AppLocaleSchema,
  ArticleCategorySchema,
  DateOnlySchema,
  ContentKeySchema,
  Schema.Finite,
  Schema.String,
]);

/** Decodes only the versioned cursor contract owned by publication pages. */
export const decodePublicationCursor = Effect.fn(
  "contentRelease.decodePublicationCursor"
)(function* (cursor: string | null) {
  if (cursor === null) {
    return null;
  }
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
  return JSON.stringify(convexToJson([...key]));
});

/** Encodes one shared merged-index position from a verified catalog row. */
export function articlePublicationCursor(row: Doc<"articleCatalog">) {
  return encodeArticlePublicationCursor(
    JSON.stringify(
      convexToJson([
        row.appLocale,
        row.category,
        row.datePublished,
        row.contentKey,
        row._creationTime,
        row._id,
      ])
    )
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
