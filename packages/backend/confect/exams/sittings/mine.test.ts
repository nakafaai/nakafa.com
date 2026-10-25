import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { HOME_RESULT_LIMIT } from "@repo/backend/confect/exams/home/bounds";
import { nf } from "@repo/backend/test/editor";
import {
  CLOSES_AT as CLOSES,
  deviceOf,
  enterOk,
  keyedExam,
  keyedSchool,
  mentions,
  OPENS_AT as OPENS,
  openedSitting,
  type SittingFixture,
  scheduleSitting,
  seedPlacement,
  sittingRow,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

const { answer, close, finish, mine } = refs.public.exams.sittings;
const { release } = refs.public.exams.results.results;

/** The first question of a sitting's exam, which the student answers. */
const firstQuestionOf = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">
) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const sitting = yield* reader
        .table("examSittings")
        .get(sittingId)
        .pipe(Effect.orDie);
      const exam = yield* reader
        .table("exams")
        .get(sitting.examId)
        .pipe(Effect.orDie);
      return {
        questionId: yield* Effect.fromOption(Arr.head(exam.questions)),
      };
    })
  );

/** The opening time of the rooms that open a day after the room that opens soon. */
const FOLLOWING_DAY = OPENS + 86_400_000;

/**
 * Writes scheduled rooms of the SMP unit with the scheduler's jobs left out, so one test can seed
 * more rooms than a list holds. The rooms are written in the order given.
 */
const insertRooms = (
  fixture: SittingFixture,
  rooms: readonly Pick<
    ExamSittingsDoc,
    "cohortId" | "examId" | "opensAt" | "room"
  >[]
) =>
  fixture.run(
    Effect.asVoid(
      Effect.forEach(rooms, (room) =>
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("examSittings").insert({
            closesAt: CLOSES,
            cohortId: room.cohortId,
            examId: room.examId,
            jobs: [],
            opensAt: room.opensAt,
            room: room.room,
            state: "scheduled",
            tenantId: fixture.tenants.nf,
            tokenHash: "",
            tokenIssuedAt: TENANCY_NOW,
            tokenSealed: new ArrayBuffer(0),
            unitId: fixture.units.smp,
          })
        ).pipe(Effect.orDie)
      )
    )
  );

/**
 * Writes closed sittings of one exam, each with one submitted attempt of the person, so the person
 * holds that many attempts newer than the ones that the test wrote before.
 */
const insertSubmittedSittings = (
  fixture: SittingFixture,
  args: {
    readonly count: number;
    readonly examId: ExamSittingsDoc["examId"];
    readonly person: ExamAttemptsDoc["person"];
  }
) =>
  fixture.run(
    Effect.asVoid(
      Effect.forEach(
        Arr.makeBy(args.count, (index) => index),
        (index) =>
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const sitting = yield* writer
              .table("examSittings")
              .insert({
                closesAt: CLOSES,
                cohortId: null,
                examId: args.examId,
                jobs: [],
                opensAt: OPENS,
                room: `Lab ${index}`,
                state: "closed",
                tenantId: fixture.tenants.nf,
                tokenHash: "",
                tokenIssuedAt: TENANCY_NOW,
                tokenSealed: new ArrayBuffer(0),
                unitId: fixture.units.smp,
              })
              .pipe(Effect.orDie);
            yield* writer
              .table("examAttempts")
              .insert({
                deadline: CLOSES,
                deviceId: null,
                person: args.person,
                retiredDeviceIds: [],
                sitting,
                startedAt: OPENS,
                state: "submitted",
                tenantId: fixture.tenants.nf,
              })
              .pipe(Effect.orDie);
          })
      )
    )
  );

describe("exams/sittings mine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect("lists a student's open unit sittings, and no token", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const listed = yield* fixture.as("student").query(mine, { slug: nf });
      expect(listed).toMatchObject([
        { id: made.id, room: "Lab 2", state: "open" },
      ]);
      expect(mentions(listed, made.token)).toBe(false);
      expect(yield* fixture.as("teacher").query(mine, { slug: nf })).toEqual(
        []
      );
    })
  );

  it.effect(
    "lists the cohort sitting of a placed student while it is scheduled",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const cohortId = yield* seedPlacement(
          fixture,
          fixture.people.student.personId
        );
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES,
          examId,
          group: { cohortId, kind: "cohort" },
          opensAt: OPENS,
        });
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(listed).toMatchObject([
          { id: made.id, cohortId, state: "scheduled" },
        ]);
      })
  );

  it.effect(
    "lists at most fifty sittings of one state for a unit, and keeps the ones that open first",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        // The fifty later rooms are written before the room that opens soon, so only the
        // opening order keeps that room in the list.
        yield* insertRooms(fixture, [
          ...Arr.makeBy(50, (index) => ({
            cohortId: null,
            examId,
            opensAt: FOLLOWING_DAY + index,
            room: `Lab ${index}`,
          })),
          { cohortId: null, examId, opensAt: OPENS, room: "Lab soon" },
        ]);
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(Arr.map(listed, (row) => row.room)).toEqual([
          "Lab soon",
          ...Arr.makeBy(49, (index) => `Lab ${index}`),
        ]);
      })
  );

  it.effect(
    "lists at most fifty sittings of one state for a cohort, and keeps the ones that open first",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const cohortId = yield* seedPlacement(
          fixture,
          fixture.people.student.personId
        );
        yield* insertRooms(fixture, [
          ...Arr.makeBy(50, (index) => ({
            cohortId,
            examId,
            opensAt: FOLLOWING_DAY + index,
            room: `Lab ${index}`,
          })),
          { cohortId, examId, opensAt: OPENS, room: "Lab soon" },
        ]);
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(Arr.map(listed, (row) => row.room)).toEqual([
          "Lab soon",
          ...Arr.makeBy(49, (index) => `Lab ${index}`),
        ]);
      })
  );

  it.effect(
    "shows each sitting with its exam's title and its unit's time zone, in one list",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(listed).toEqual([
          expect.objectContaining({
            examTitle: "PTS",
            id: made.id,
            timeZone: "Asia/Jakarta",
          }),
        ]);
      })
  );

  it.effect(
    "shows the state of the student's own attempt in each live sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const before = yield* fixture.as("student").query(mine, { slug: nf });
        expect(before).toMatchObject([{ attempt: null, id: made.id }]);
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const entered = yield* fixture.as("student").query(mine, { slug: nf });
        expect(entered).toMatchObject([
          { attempt: "inProgress", id: made.id, state: "open" },
        ]);
      })
  );

  it.effect(
    "keeps a closed sitting in the student's list while the attempt in it is submitted",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.as("student").mutation(finish, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          slug: nf,
        });
        yield* fixture.as("teacher").mutation(close, {
          sittingId: made.id,
          slug: nf,
        });
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(listed).toEqual([
          expect.objectContaining({
            attempt: "submitted",
            id: made.id,
            resultsReleased: false,
            state: "closed",
          }),
        ]);
      })
  );

  it.effect(
    "shows the student's weighted score in a closed sitting only once the teacher releases its results",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const { questionId } = yield* firstQuestionOf(fixture, made.id);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("examQuestions").patch(questionId, { points: 5 })
          )
        );
        yield* fixture.as("student").mutation(answer, {
          deviceId: deviceOf(1),
          questionId,
          response: ["option-1"],
          sittingId: made.id,
          slug: nf,
          version: 1,
        });
        yield* fixture.as("student").mutation(finish, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          slug: nf,
        });
        yield* fixture.as("teacher").mutation(close, {
          sittingId: made.id,
          slug: nf,
        });
        expect(
          yield* fixture.as("student").query(mine, { slug: nf })
        ).toMatchObject([{ resultsReleased: false, score: null }]);
        yield* fixture.as("teacher").mutation(release, {
          sittingId: made.id,
          slug: nf,
        });
        expect(
          yield* fixture.as("student").query(mine, { slug: nf })
        ).toMatchObject([
          {
            resultsReleased: true,
            score: { points: 5, total: 5 },
          },
        ]);
      })
  );

  it.effect("leaves out a closed sitting that the student never entered", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      yield* fixture.as("teacher").mutation(close, {
        sittingId: made.id,
        slug: nf,
      });
      expect(yield* fixture.as("student").query(mine, { slug: nf })).toEqual(
        []
      );
    })
  );

  it.effect(
    "shows a live sitting as submitted once the student finishes it, so the student does not enter it again",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.as("student").mutation(finish, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          slug: nf,
        });
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(listed).toMatchObject([
          {
            attempt: "submitted",
            attemptId: entered.attempt,
            id: made.id,
            state: "open",
          },
        ]);
      })
  );

  it.effect(
    "shows a live sitting's attempt however many newer submitted attempts the student holds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* insertSubmittedSittings(fixture, {
          count: 100,
          examId: (yield* sittingRow(fixture, made.id)).examId,
          person: fixture.people.student.personId,
        });
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        // The live sitting, and the newest closed sittings the home lists.
        expect(listed).toHaveLength(HOME_RESULT_LIMIT + 1);
        expect(
          Option.getOrNull(Arr.findFirst(listed, (row) => row.id === made.id))
        ).toMatchObject({
          attempt: "inProgress",
          attemptId: entered.attempt,
        });
      })
  );

  it.effect(
    "keeps a closed sitting in the student's list while the student's attempt in it is still closing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        // The close job moves the attempt to closing, and the tests do not run scheduled jobs, so the
        // test writes the sitting and the attempt in the state that the job leaves them in.
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("examSittings")
              .patch(made.id, { state: "closed" })
              .pipe(Effect.orDie)
          )
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("examAttempts")
              .patch(entered.attempt, { state: "closing" })
              .pipe(Effect.orDie)
          )
        );
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(listed).toMatchObject([
          {
            attempt: "closing",
            attemptId: entered.attempt,
            id: made.id,
            state: "closed",
          },
        ]);
      })
  );
});
