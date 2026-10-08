import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  PROGRAM_FEATURED_SUBJECT_LIMIT,
  PROGRAM_SUBJECT_LIMIT,
} from "@repo/backend/confect/contentRelease/program/limits";
import { readAncestors } from "@repo/backend/content/program/model";
import { loadProgramOwner } from "@repo/backend/content/program/owner";
import { ProgramSource } from "@repo/backend/content/program/source";
import { verifyCurriculum } from "@repo/backend/content/program/verify";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { Array as Arr, Effect, Order, pipe } from "effect";

/** Reads one subject route with the authored position that orders it in its program. */
const readSubjectCandidate = Effect.fn(
  "contentRelease.readProgramSubjectCandidate"
)(function* (snapshotId: string, row: PublicationRow<"curriculumRoutes">) {
  const route = yield* verifyCurriculum(row, snapshotId);
  const ancestors = yield* readAncestors(snapshotId, route);
  return {
    domain: route.materialDomain,
    // Each ancestor's authored order from the program root down, then the
    // subject's own order among its siblings.
    position: [...ancestors.map(({ order }) => order), row.order],
    row,
  };
});

/** One public subject route with its material domain and authored position. */
type SubjectCandidate = Effect.Success<ReturnType<typeof readSubjectCandidate>>;

/**
 * Ancestor orders from the program root down, then the program and node keys.
 * Tied positions fall back to those keys rather than the translated public
 * path, so every locale features the same subjects in the same order.
 */
const authoredOrder = Order.combineAll([
  Order.mapInput(
    Arr.makeOrder(Order.Number),
    (subject: SubjectCandidate) => subject.position
  ),
  Order.mapInput(
    Order.String,
    (subject: SubjectCandidate) => subject.row.programKey
  ),
  Order.mapInput(
    Order.String,
    (subject: SubjectCandidate) => subject.row.nodeKey
  ),
]);

/**
 * Reads the featured subjects of one active program snapshot: the first public
 * subject route of each material domain in authored order, so every subject
 * appears once however many classes teach it, in the same order in every
 * locale. A subject route without a material domain names no subject to
 * feature.
 */
export const readProgramSubjects = Effect.fn(
  "contentRelease.readProgramSubjects"
)(function* (appLocale: PublicationRow<"curriculumRoutes">["appLocale"]) {
  const owner = yield* loadProgramOwner(appLocale);
  if (!(owner.managed && owner.selected)) {
    return {
      managed: false,
      routeJson: [],
    };
  }
  const { snapshotId } = owner.selected;
  const source = yield* ProgramSource;
  const rows = yield* source.subjects(
    snapshotId,
    appLocale,
    PROGRAM_SUBJECT_LIMIT + 1
  );
  if (rows.length > PROGRAM_SUBJECT_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Program subjects exceed ${PROGRAM_SUBJECT_LIMIT} routes.`
    );
  }
  const subjects = yield* Effect.forEach(rows, (row) =>
    readSubjectCandidate(snapshotId, row)
  );
  const featured = pipe(
    subjects,
    Arr.sort(authoredOrder),
    Arr.filter(({ domain }) => domain !== undefined),
    Arr.dedupeWith((left, right) => left.domain === right.domain),
    Arr.take(PROGRAM_FEATURED_SUBJECT_LIMIT)
  );
  return {
    managed: true,
    routeJson: Arr.map(featured, ({ row }) => row.rowJson),
  };
});
