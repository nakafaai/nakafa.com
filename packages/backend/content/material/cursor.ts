import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { Effect, Schema } from "effect";

const MATERIAL_POSITION_PREFIX = "material-route|";
const MaterialPositionSchema = Schema.Tuple([
  Schema.String,
  AppLocaleSchema,
  PublicPathSchema,
]);
type MaterialRow = PublicationRow<"materialCatalog">;

/** Recognizes semantic material positions inside the release cursor envelope. */
export function isMaterialPosition(cursor: string) {
  return cursor.startsWith(MATERIAL_POSITION_PREFIX);
}

/** Encodes the unique localized material boundary shared by build and live reads. */
export function materialPosition(row: MaterialRow) {
  return `${MATERIAL_POSITION_PREFIX}${JSON.stringify([row.slot, row.appLocale, row.publicPath])}`;
}

/** Rejects a semantic material position that belongs to another query. */
export const decodeMaterialPosition = Effect.fn(
  "material.decodeMaterialPosition"
)(function* (
  cursor: string | null,
  slot: MaterialRow["slot"],
  appLocale: MaterialRow["appLocale"]
) {
  if (cursor === null) {
    return null;
  }
  const invalid = () =>
    new ReleaseError({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: "Material cursor has an invalid query position.",
    });
  if (!isMaterialPosition(cursor)) {
    return yield* invalid();
  }
  const parsed = yield* Effect.try({
    try: (): unknown =>
      JSON.parse(cursor.slice(MATERIAL_POSITION_PREFIX.length)),
    catch: invalid,
  });
  const position = yield* Schema.decodeUnknownEffect(MaterialPositionSchema)(
    parsed
  ).pipe(Effect.mapError(invalid));
  if (position[0] !== slot || position[1] !== appLocale) {
    return yield* invalid();
  }
  return position;
});
