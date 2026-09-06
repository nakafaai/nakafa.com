import { loadProgramOwner } from "@repo/backend/content/program/owner";
import { ProgramSource } from "@repo/backend/content/program/source";
import { verifyCurriculum } from "@repo/backend/content/program/verify";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { PROGRAM_FEATURED_SUBJECT_LIMIT } from "@repo/backend/convex/contentRelease/program/limits";
import { Effect } from "effect";

/** Reads a fixed-size public subject sample from one active program snapshot. */
export const readProgramSubjects = Effect.fn(
  "contentRelease.readProgramSubjects"
)(function* (appLocale: PublicationRow<"curriculumRoutes">["appLocale"]) {
  const owner = yield* loadProgramOwner(appLocale);
  if (!(owner.managed && owner.selected)) {
    return { managed: false, routeJson: [] };
  }
  const source = yield* ProgramSource;
  const rows = yield* source.subjects(
    owner.selected.snapshotId,
    appLocale,
    PROGRAM_FEATURED_SUBJECT_LIMIT
  );
  yield* Effect.forEach(rows, (row) =>
    verifyCurriculum(row, owner.selected.snapshotId)
  );
  return { managed: true, routeJson: rows.map(({ rowJson }) => rowJson) };
});
