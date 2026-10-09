import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Schema } from "effect";

const PROGRAM_POSITION_PREFIX = "program-route|";
const ProgramPositionSchema = Schema.Tuple([
  Schema.String,
  AppLocaleSchema,
  PublicPathSchema,
]);
type RouteRow = PublicationRow<"curriculumRoutes">;

/** Recognizes semantic curriculum positions while preserving native cursors. */
export function isProgramPosition(cursor: string) {
  return cursor.startsWith(PROGRAM_POSITION_PREFIX);
}

/** Encodes the immutable localized route boundary without database identities. */
export function programPosition(row: RouteRow) {
  return `${PROGRAM_POSITION_PREFIX}${encodeJsonText([row.snapshotId, row.appLocale, row.path])}`;
}

/** Requires a curriculum cursor to belong to its exact snapshot and locale. */
export const decodeProgramPosition = Effect.fn("program.decodeProgramPosition")(
  function* (
    cursor: string | null,
    snapshotId: string,
    appLocale: RouteRow["appLocale"]
  ) {
    if (cursor === null) {
      return null;
    }
    const invalid = () =>
      ReleaseError.make({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: "Program cursor has an invalid query position.",
      });
    const position = yield* Schema.decodeEffect(
      Schema.fromJsonString(ProgramPositionSchema)
    )(cursor.slice(PROGRAM_POSITION_PREFIX.length)).pipe(
      Effect.mapError(invalid)
    );
    if (position[0] !== snapshotId || position[1] !== appLocale) {
      return yield* invalid();
    }
    return position;
  }
);
