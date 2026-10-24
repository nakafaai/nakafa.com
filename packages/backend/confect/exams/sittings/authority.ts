import { MiddlewareImpl } from "@confect/server";
import type {
  ExamSittingsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Authority } from "@repo/backend/confect/access/policy";
import {
  Sitting,
  SittingAccess,
  type SittingWithExam,
} from "@repo/backend/confect/exams/sittings/access";
import { sittingKind } from "@repo/backend/confect/exams/sittings/kinds";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  cohortLocked,
  scopePlace,
} from "@repo/backend/confect/tenancy/authority";
import { Effect, Option } from "effect";

/**
 * Whether the Person is the account that created the sitting's exam. Only a claimed
 * Person has an account, so an unclaimed Person is never the author.
 */
export const isExamAuthor = (exam: ExamsDoc, member: Member["Service"]) => {
  const { account } = member.person;
  return account.state === "claimed" && exam.createdBy === account.userId;
};

/**
 * Reads the exam of a sitting beside its row. A sitting's exam is never deleted, so a
 * missing exam is a defect of the stored data.
 */
export const withExam = Effect.fn("exams.sittings.authority.exam")(function* (
  sitting: ExamSittingsDoc
) {
  const exam = yield* (yield* DatabaseReader)
    .table("exams")
    .get(sitting.examId)
    .pipe(Effect.orDie);
  return { ...sitting, exam };
});

/**
 * Loads a sitting by its ID with its exam, so every decision and view of the sitting reads the
 * exam once.
 */
const loadSitting = Effect.fn("exams.sittings.authority.load")(function* (
  id: ExamSittingsDoc["_id"]
) {
  const found = yield* Authority.load(sittingKind)(id);
  return yield* Option.match(found, {
    onNone: () => Effect.succeed(Option.none<SittingWithExam>()),
    onSome: (sitting) => withExam(sitting).pipe(Effect.asSome),
  });
});

/**
 * Whether the cohort of a cohort sitting is locked: its own archive, its period's, or its
 * unit's locks the sitting too. A unit sitting holds no cohort, so no cohort locks it.
 */
const cohortLockedOf = Effect.fn("exams.sittings.authority.cohort")(function* (
  row: Pick<ExamSittingsDoc, "cohortId">
) {
  if (row.cohortId === null) {
    return false;
  }
  const reader = yield* DatabaseReader;
  const cohort = yield* reader
    .table("tenantCohorts")
    .get(row.cohortId)
    .pipe(Effect.orDie);
  const period = yield* reader
    .table("tenantPeriods")
    .get(cohort.periodId)
    .pipe(Effect.orDie);
  const unit = yield* reader
    .table("tenantUnits")
    .get(cohort.unitId)
    .pipe(Effect.orDie);
  return cohortLocked(cohort, period, unit);
});

/**
 * A sitting sits in its unit, so an archived unit locks it, and a closed sitting is
 * locked as well (ADR 0012, decision 3). A cohort sitting sits in its cohort too, so an
 * archived cohort or period locks it.
 */
export const sittingAuthority = Authority.make(sittingKind, loadSitting, {
  place: (row) =>
    Effect.all({
      cohort: cohortLockedOf(row),
      placement: scopePlace({ kind: "unit", unitId: row.unitId }),
    }).pipe(
      Effect.map(({ cohort, placement }) => ({
        locked: placement.locked || cohort || row.state === "closed",
        units: placement.units,
      }))
    ),
  relations: {
    examAuthor: (row, member) => Effect.succeed(isExamAuthor(row.exam, member)),
  },
  tenantOf: (row) => row.tenantId,
});

/** Checks a sitting action on the sitting its access spec names, and provides the loaded sitting. */
export const sittingAccess = MiddlewareImpl.make(
  databaseSchema,
  SittingAccess,
  sittingAuthority.middleware(Sitting)
);
