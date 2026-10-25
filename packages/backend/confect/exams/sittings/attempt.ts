import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { NotInSitting } from "@repo/backend/confect/exams/sittings/errors";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect, Option } from "effect";

/**
 * The sitting that a caller names. A missing sitting and another school's sitting are both
 * `NotInSitting`, so the reply names no part of the sitting.
 */
export const sittingOf = Effect.fn("exams.sittings.attempt.sitting")(function* (
  sittingId: ExamSittingsDoc["_id"],
  tenantId: ExamSittingsDoc["tenantId"]
) {
  const found = yield* (yield* DatabaseReader)
    .table("examSittings")
    .get(sittingId)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
  const row = Option.filter(found, (sitting) => sitting.tenantId === tenantId);
  if (Option.isNone(row)) {
    return yield* new NotInSitting();
  }
  return row.value;
});

/** The attempt that this Person holds in the sitting, if any. */
export const attemptOf = Effect.fn("exams.sittings.attempt.of")(function* (
  sittingId: ExamSittingsDoc["_id"],
  personId: TenantPeopleDoc["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("examAttempts")
    .index("by_sittingId_and_personId", (query) =>
      query.eq("sitting", sittingId).eq("person", personId)
    )
    .first()
    .pipe(Effect.orDie);
});

/**
 * The attempt that a proctor's action acts on. It must belong to the sitting that the
 * action names, so an attempt of another sitting is refused as a resource.
 */
export const attemptIn = Effect.fn("exams.sittings.attempt.in")(function* (
  sitting: ExamSittingsDoc,
  attemptId: ExamAttemptsDoc["_id"],
  action: string
) {
  const found = yield* (yield* DatabaseReader)
    .table("examAttempts")
    .get(attemptId)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
  const row = Option.filter(
    found,
    (attempt) => attempt.sitting === sitting._id
  );
  if (Option.isNone(row)) {
    return yield* new AccessDenied({ action, reason: "resource" });
  }
  return row.value;
});

/** An attempt as its student's screen reads it, or `null` when the student holds none. */
export const heldView = (held: Option.Option<ExamAttemptsDoc>) =>
  Option.match(held, {
    onNone: () => null,
    onSome: (attempt) => ({
      deadline: attempt.deadline,
      id: attempt._id,
      startedAt: attempt.startedAt,
      state: attempt.state,
    }),
  });

/** The caller's own attempt in a sitting, as the student's screen reads it, or `null` when there is none. */
export const heldAttempt = Effect.fn("exams.sittings.attempt.held")(function* (
  sittingId: ExamSittingsDoc["_id"]
) {
  const member = yield* Member;
  return heldView(yield* attemptOf(sittingId, member.person._id));
});
