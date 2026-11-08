import type { GenericId } from "@confect/core";
import type {
  GraduationLettersDoc,
  GraduationsDoc,
  RosterEntriesDoc,
  TenantCohortsDoc,
  TenantUnitsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { fileAddress } from "@repo/backend/confect/bucket/file";
import { reportOf } from "@repo/backend/confect/records/card";
import { GraduationNotFinal } from "@repo/backend/confect/records/errors";
import type { GraduationView } from "@repo/backend/confect/records/graduation";
import type {
  GraduationLine,
  LetterView,
  Missing,
  Transcript,
} from "@repo/backend/confect/records/letter";
import { transcriptOf } from "@repo/backend/confect/records/transcript";
import { rosterEntryOf } from "@repo/backend/confect/roster/entry";
import { lastGradeOf } from "@repo/backend/confect/tenancy/grades";
import { listedPersonOf } from "@repo/backend/confect/tenancy/listed";
import { Array as Arr, Effect, Option, Struct } from "effect";

/** The unit a class group belongs to. */
export const unitOf = Effect.fn("records.graduations.unitOf")(function* (
  cohort: TenantCohortsDoc
) {
  return yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .get(cohort.unitId)
    .pipe(Effect.orDie);
});

/**
 * Whether a class group graduates: only the last grade of its unit does, and a unit without a
 * last grade (PAUD, SLB, other) has no graduation.
 */
export const graduates = (unit: TenantUnitsDoc, cohort: TenantCohortsDoc) =>
  Option.contains(lastGradeOf(unit.level), cohort.grade);

/** The unit of a graduating class group, which every page and write of its graduation needs. */
export const finalUnit = Effect.fn("records.graduations.finalUnit")(function* (
  cohort: TenantCohortsDoc
) {
  const unit = yield* unitOf(cohort);
  if (!graduates(unit, cohort)) {
    return yield* new GraduationNotFinal();
  }
  return unit;
});

/** The graduation decision of a unit's period, if the principal recorded one. */
export const graduationOf = Effect.fn("records.graduations.of")(function* (
  periodId: GenericId.GenericId<"tenantPeriods">
) {
  return yield* (yield* DatabaseReader)
    .table("graduations")
    .get("by_periodId", periodId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
});

/** The decision as the graduation page shows it. */
export const graduationView = (
  row: GraduationsDoc
): typeof GraduationView.Type =>
  Struct.pick(row, ["date", "decision", "head", "issued", "nip", "place"]);

/** The SKL of one student from one class group, if the principal issued it. */
const letterOf = Effect.fn("records.graduations.letterOf")(function* (
  cohortId: GenericId.GenericId<"tenantCohorts">,
  personId: GenericId.GenericId<"tenantPeople">
) {
  return yield* (yield* DatabaseReader)
    .table("graduationLetters")
    .get("by_cohortId_and_personId", cohortId, personId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
});

/** An SKL as the graduation page shows it, with the address of its PDF once it is locked. */
const letterView = Effect.fn("records.graduations.letterView")(function* (
  letter: GraduationLettersDoc
) {
  // A locked letter holds its file; the address is signed for the hour.
  const file =
    letter.fileId === undefined
      ? null
      : Option.getOrNull(yield* fileAddress(letter.fileId));
  const view: typeof LetterView.Type = {
    file,
    hash: letter.hash,
    id: letter._id,
    number: letter.number,
    state: letter.state,
  };
  return view;
});

/**
 * What keeps a student from an SKL and from the e-Ijazah, in a fixed order: the unit's NPSN,
 * the unit's decision on graduation, the student's NISN, and a locked report card with grades in
 * the class group. A student with none missing is ready.
 */
const missingOf = (facts: {
  readonly entry: Option.Option<RosterEntriesDoc>;
  readonly graduation: Option.Option<GraduationsDoc>;
  readonly locked: boolean;
  readonly unit: TenantUnitsDoc;
}): readonly (typeof Missing.Type)[] =>
  Arr.getSomes([
    facts.unit.npsn === undefined
      ? Option.some("npsn" as const)
      : Option.none(),
    Option.isNone(facts.graduation)
      ? Option.some("decision" as const)
      : Option.none(),
    Option.exists(facts.entry, (entry) => entry.nisn !== undefined)
      ? Option.none()
      : Option.some("nisn" as const),
    facts.locked ? Option.none() : Option.some("report" as const),
  ]);

/**
 * One line of a graduating class group: the student, whether a NISN is on file, their
 * transcript data (the copy their SKL took at issue, or the one their locked report cards give
 * now), their SKL or none, and what is missing for it. `entry` is the student's roster row,
 * which the readiness rows also open.
 */
export const lineOf = Effect.fn("records.graduations.line")(function* (
  cohort: TenantCohortsDoc,
  unit: TenantUnitsDoc,
  graduation: Option.Option<GraduationsDoc>,
  personId: GenericId.GenericId<"tenantPeople">
) {
  const [person, entry, report, letter] = yield* Effect.all([
    (yield* DatabaseReader)
      .table("tenantPeople")
      .get(personId)
      .pipe(Effect.orDie),
    rosterEntryOf(personId),
    reportOf(cohort._id, personId),
    letterOf(cohort._id, personId),
  ]);
  const transcript: Option.Option<typeof Transcript.Type> = Option.isSome(
    letter
  )
    ? Option.some(Struct.pick(letter.value, ["average", "subjects"]))
    : yield* transcriptOf(personId, unit._id);
  const line: typeof GraduationLine.Type = {
    hasNisn: Option.exists(entry, (found) => found.nisn !== undefined),
    letter: Option.isSome(letter) ? yield* letterView(letter.value) : null,
    missing: missingOf({
      entry,
      graduation,
      locked:
        Option.exists(report, (found) => found.state === "locked") &&
        Option.isSome(transcript),
      unit,
    }),
    student: yield* listedPersonOf(person),
    transcript: Option.getOrNull(transcript),
  };
  return { entry, line, transcript };
});
