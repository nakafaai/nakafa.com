import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Schema } from "effect";

const CATEGORY_POSITION_PREFIX = "article-category|";
const CategoryPositionSchema = Schema.Tuple([
  Schema.String,
  AppLocaleSchema,
  ArticleCategorySchema,
]);
type CategoryRow = PublicationRow<"articleCategories">;

/** Recognizes semantic category positions inside the release cursor envelope. */
export function isCategoryPosition(cursor: string) {
  return cursor.startsWith(CATEGORY_POSITION_PREFIX);
}

/** Encodes the unique localized category boundary shared by build and live reads. */
export function categoryPosition(row: CategoryRow) {
  const key = encodeJsonText([row.slot, row.appLocale, row.category]);
  return `${CATEGORY_POSITION_PREFIX}${key}`;
}

/** Rejects a semantic category position that belongs to another query. */
export const decodeCategoryPosition = Effect.fn(
  "article.decodeCategoryPosition"
)(function* (
  cursor: string | null,
  slot: CategoryRow["slot"],
  appLocale: CategoryRow["appLocale"]
) {
  if (cursor === null) {
    return null;
  }
  const invalid = () =>
    new ReleaseError({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: "Article category cursor has an invalid query position.",
    });
  const position = yield* Schema.decodeEffect(
    Schema.fromJsonString(CategoryPositionSchema)
  )(cursor.slice(CATEGORY_POSITION_PREFIX.length)).pipe(
    Effect.mapError(invalid)
  );
  if (position[0] !== slot || position[1] !== appLocale) {
    return yield* invalid();
  }
  return position;
});
