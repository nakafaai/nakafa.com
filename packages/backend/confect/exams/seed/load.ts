import type { ExamQuestionsDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  firstActiveUnit,
  tenantOf,
} from "@repo/backend/confect/acceptance/lookup";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import {
  ownerUserId,
  seedQuestion,
} from "@repo/backend/confect/exams/seed/sitting";
import { openSitting } from "@repo/backend/confect/exams/sittings/closing";
import { createSitting } from "@repo/backend/confect/exams/sittings/schedule";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { Array as Arr, Clock, Effect, Option } from "effect";

/** The title of the load test's exam. */
const EXAM_TITLE = "Ujian Beban";

/** Two hours, the length of each room of the load test: longer than any run of it. */
const ROOM_LENGTH_MS = 2 * 60 * 60 * 1000;

/** The room name of one room of the load test, by its number from one. */
const roomName = (room: number) => `Ruang ${String(room).padStart(2, "0")}`;

/**
 * Seeds the exam of the load test (K26) in a school that `createSchool` opened: a keyed exam of
 * `questions` choice questions, each keyed to its first option, and `rooms` sittings of it in the
 * school's first active unit, which open now and close two hours later. It returns the exam and
 * every room with its token, which the load test's students enter with. The journal records each
 * schedule as the system (ADR 0013).
 */
export const seedLoad = Effect.fn("exams.seed.load")(function* (args: {
  readonly questions: number;
  readonly rooms: number;
  readonly slug: string;
}) {
  yield* requireAcceptanceSeed();
  const tenant = yield* tenantOf(args.slug);
  const unit = yield* firstActiveUnit(tenant._id);
  const now = yield* Clock.currentTimeMillis;
  const scope: GrantScope = { kind: "unit", unitId: unit._id };
  const examId = yield* (yield* DatabaseWriter)
    .table("exams")
    .insert({
      createdAt: now,
      createdBy: yield* ownerUserId(tenant._id),
      questions: [],
      scope,
      tenantId: tenant._id,
      title: EXAM_TITLE,
    })
    .pipe(Effect.orDie);
  // Each question goes after the one before it, so the exam holds them in their numbered order.
  yield* Effect.reduce(
    Arr.makeBy(args.questions, (index) => index + 1),
    () => Arr.empty<ExamQuestionsDoc["_id"]>(),
    (placed, number) =>
      seedQuestion(
        { _id: examId, questions: placed, scope, tenantId: tenant._id },
        Option.getOrNull(Arr.last(placed)),
        [`Soal ${number}.`]
      ).pipe(Effect.map((id) => Arr.append(placed, id)))
  );
  const exam = yield* (yield* DatabaseReader)
    .table("exams")
    .get(examId)
    .pipe(Effect.orDie);
  const sittings = yield* Effect.forEach(
    Arr.makeBy(args.rooms, (index) => roomName(index + 1)),
    (room) =>
      createSitting({
        actor: systemActor,
        closesAt: now + ROOM_LENGTH_MS,
        exam,
        opensAt: now,
        place: { cohortId: null, unitId: unit._id },
        room,
        tenantId: tenant._id,
      }).pipe(
        Effect.orDie,
        Effect.tap((made) => openSitting(made.id)),
        Effect.map((made) => ({ id: made.id, room, token: made.token }))
      )
  );
  return { examId, sittings };
});
