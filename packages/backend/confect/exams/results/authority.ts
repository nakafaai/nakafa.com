import { MiddlewareImpl } from "@confect/server";
import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Authority } from "@repo/backend/confect/access/policy";
import {
  ResultAccess,
  ResultSitting,
} from "@repo/backend/confect/exams/results/access";
import { resultKind } from "@repo/backend/confect/exams/results/kinds";
import { isExamAuthor } from "@repo/backend/confect/exams/sittings/authority";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { scopePlace } from "@repo/backend/confect/tenancy/authority";
import { Effect } from "effect";

/** Loads one sitting by its ID, where a missing one is `None`, as `Authority.load` loads a subject. */
const loadSitting = Effect.fn("exams.results.authority.load")(function* (
  id: ExamSittingsDoc["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("examSittings")
    .get(id)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
});

/** Whether the Person is the author of the sitting's exam, read from the exam row. */
const examAuthor = Effect.fn("exams.results.author")(function* (
  row: ExamSittingsDoc,
  member: Member["Service"]
) {
  const exam = yield* (yield* DatabaseReader)
    .table("exams")
    .get(row.examId)
    .pipe(Effect.orDie);
  return isExamAuthor(exam, member);
});

/**
 * The results of a sitting. Its place is its unit alone, so an archived unit locks a release, and a
 * closed sitting does not, because releasing follows the close. The journal files each release under
 * the sitting, and the Person who released it is its actor.
 */
export const resultAuthority = Authority.make(resultKind, loadSitting, {
  place: (row) => scopePlace({ kind: "unit", unitId: row.unitId }),
  relations: { examAuthor },
  tenantOf: (row) => row.tenantId,
});

/** Checks a result action on the sitting its access spec names, and provides the loaded sitting. */
export const resultAccess = MiddlewareImpl.make(
  databaseSchema,
  ResultAccess,
  resultAuthority.middleware(ResultSitting)
);
