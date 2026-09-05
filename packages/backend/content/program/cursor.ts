import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
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
  return `${PROGRAM_POSITION_PREFIX}${JSON.stringify([row.snapshotId, row.appLocale, row.path])}`;
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
      new ReleaseError({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: "Program cursor has an invalid query position.",
      });
    if (!isProgramPosition(cursor)) {
      return yield* invalid();
    }
    const parsed = yield* Effect.try({
      try: (): unknown =>
        JSON.parse(cursor.slice(PROGRAM_POSITION_PREFIX.length)),
      catch: invalid,
    });
    const position = yield* Schema.decodeUnknownEffect(ProgramPositionSchema)(
      parsed
    ).pipe(Effect.mapError(invalid));
    if (position[0] !== snapshotId || position[1] !== appLocale) {
      return yield* invalid();
    }
    return position;
  }
);
