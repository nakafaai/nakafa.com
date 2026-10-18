import type {
  ExamQuestionsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { keyFits } from "@repo/backend/confect/exams/key";
import { questionView } from "@repo/backend/confect/exams/question";
import { sittingAuthority } from "@repo/backend/confect/exams/sittings/authority";
import {
  KeysMissing,
  ScheduleInvalid,
} from "@repo/backend/confect/exams/sittings/errors";
import type {
  RoomName,
  SittingGroup,
} from "@repo/backend/confect/exams/sittings/schema";
import {
  scheduleClose,
  scheduleOpen,
} from "@repo/backend/confect/exams/sittings/timers";
import {
  drawToken,
  tokenHash,
} from "@repo/backend/confect/exams/sittings/token";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { authorizeScope } from "@repo/backend/confect/tenancy/authority";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import { Array as Arr, Clock, Effect, Option } from "effect";

/**
 * How long before the scheduling a sitting may have opened. An opening that is more than
 * this far in the past is refused, so a schedule never opens a sitting whose time has passed.
 */
const OPEN_PAST_LIMIT_MS = 60_000;

/**
 * The unit and the cohort that a sitting holds. A unit sitting holds no cohort. A cohort
 * sitting takes its unit from the cohort. The caller must be allowed to edit the unit, and
 * the cohort must be active.
 */
const placeOf = Effect.fn("exams.sittings.schedule.place")(function* (
  group: typeof SittingGroup.Type,
  tenantId: ExamsDoc["tenantId"]
) {
  if (group.kind === "unit") {
    yield* authorizeScope("exam.edit", { kind: "unit", unitId: group.unitId });
    return { cohortId: null, unitId: group.unitId };
  }
  const found = yield* (yield* DatabaseReader)
    .table("tenantCohorts")
    .get(group.cohortId)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
  const cohort = Option.filter(found, (row) => row.tenantId === tenantId);
  if (Option.isNone(cohort)) {
    return yield* new AccessDenied({ action: "exam.edit", reason: "resource" });
  }
  yield* authorizeScope("exam.edit", {
    kind: "unit",
    unitId: cohort.value.unitId,
  });
  if (cohort.value.status !== "active") {
    return yield* new ScheduleInvalid({ reason: "cohort" });
  }
  return { cohortId: cohort.value._id, unitId: cohort.value.unitId };
});

/**
 * Refuses a schedule while a question has no answer key that fits it. The reply names
 * the order number of each such question, counted from one (round 2, decision 10).
 */
const keysFit = Effect.fn("exams.sittings.schedule.keys")(function* (
  questions: readonly ExamQuestionsDoc["_id"][]
) {
  const reader = yield* DatabaseReader;
  const views = yield* Effect.forEach(questions, (id) =>
    reader
      .table("examQuestions")
      .get(id)
      .pipe(Effect.orDie, Effect.flatMap(questionView))
  );
  const unkeyed = Arr.flatMap(views, (view, index) =>
    view.key !== null && keyFits(view.answers, view.key) ? [] : [index + 1]
  );
  if (unkeyed.length > 0) {
    return yield* new KeysMissing({ questions: unkeyed });
  }
});

/**
 * Creates a sitting of an exam for one group in one room, with a new token, and schedules
 * its opening and its closing (ADR 0013). The closing must come after the opening, and the
 * opening may be at most a minute in the past. The token is returned to the proctor who
 * schedules it, and only as a keyed hash is it kept.
 */
export const scheduleSitting = Effect.fn("exams.sittings.schedule")(
  function* (args: {
    closesAt: number;
    exam: ExamsDoc;
    group: typeof SittingGroup.Type;
    opensAt: number;
    room: typeof RoomName.Type;
  }) {
    if (!(args.opensAt < args.closesAt)) {
      return yield* new ScheduleInvalid({ reason: "closesAt" });
    }
    const now = yield* Clock.currentTimeMillis;
    if (args.opensAt < now - OPEN_PAST_LIMIT_MS) {
      return yield* new ScheduleInvalid({ reason: "opensAt" });
    }
    const member = yield* Member;
    const tenantId = member.tenant._id;
    const place = yield* placeOf(args.group, tenantId);
    yield* keysFit(args.exam.questions);
    const id = yield* (yield* DatabaseWriter)
      .table("examSittings")
      .insert({
        closesAt: args.closesAt,
        cohortId: place.cohortId,
        examId: args.exam._id,
        jobs: [],
        opensAt: args.opensAt,
        room: args.room,
        state: "scheduled",
        tenantId,
        tokenHash: "",
        tokenIssuedAt: now,
        unitId: place.unitId,
      })
      .pipe(Effect.orDie);
    const token = yield* drawToken().pipe(Effect.orDie);
    const keys = yield* readTenantKeys(tenantId).pipe(Effect.orDie);
    const hash = yield* tokenHash(keys, id, token).pipe(Effect.orDie);
    const openJob = yield* scheduleOpen(id, args.opensAt);
    const closeJob = yield* scheduleClose(id, args.closesAt);
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("examSittings")
      .patch(id, { jobs: [openJob, closeJob], tokenHash: hash })
      .pipe(Effect.orDie);
    const row = yield* (yield* DatabaseReader)
      .table("examSittings")
      .get(id)
      .pipe(Effect.orDie);
    yield* sittingAuthority.record(personActor(member.person), row, {
      type: "sitting.schedule",
    });
    return { id, token };
  }
);
