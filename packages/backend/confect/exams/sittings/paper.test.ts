import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import { fillExam } from "@repo/backend/test/exams";
import {
  CLOSES_AT as CLOSES,
  deviceOf,
  enterOk,
  keyedExam,
  keyedSchool,
  OPENS_AT as OPENS,
  openedSitting,
  type SittingFixture,
  scheduleSitting,
} from "@repo/backend/test/sittings";
import {
  suspend,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Record } from "effect";

const { allowDevice, answer, flag, lock, paper, saved } =
  refs.public.exams.sittings;
const open = refs.internal.exams.sittings.timers.open;

/** The paper of one device in one sitting, read by the student. */
const paperOf = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">,
  deviceId: string
) => fixture.as("student").query(paper, { deviceId, sittingId, slug: nf });

/** What one device saved on the paper of one sitting, read by the student. */
const savedOf = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">,
  deviceId: string
) => fixture.as("student").query(saved, { deviceId, sittingId, slug: nf });

describe("exams/sittings paper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "gives the bound student each question with its interactions, and no answer key, prompt, or saved answer",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const { questions } = yield* paperOf(fixture, made.id, deviceOf(1));
        const [question] = questions;
        expect(question.number).toBe(1);
        expect(question.interactions).toHaveLength(1);
        expect(Record.keys(question)).toEqual(["id", "interactions", "number"]);
      })
  );

  it.effect(
    "gives the questions in the order of the exam, keeps the paper as it was after an answer and a flag, and shows them in what the student saved",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const exam = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("exams").get(examId).pipe(Effect.orDie)
          )
        );
        yield* fixture.run(fillExam(examId, exam.questions[0], 2));
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS,
        });
        vi.setSystemTime(OPENS);
        yield* fixture.internal.mutation(open, { sittingId: made.id });
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const before = yield* paperOf(fixture, made.id, deviceOf(1));
        expect(
          Arr.map(before.questions, (question) => question.number)
        ).toEqual([1, 2]);
        expect(before.questions[0].id).toBe(exam.questions[0]);
        const second = before.questions[1];
        yield* fixture.as("student").mutation(answer, {
          deviceId: deviceOf(1),
          questionId: second.id,
          response: ["option-2"],
          sittingId: made.id,
          slug: nf,
          version: 1,
        });
        yield* fixture.as("student").mutation(flag, {
          deviceId: deviceOf(1),
          flagged: true,
          questionId: second.id,
          sittingId: made.id,
          slug: nf,
        });
        expect(yield* paperOf(fixture, made.id, deviceOf(1))).toEqual(before);
        expect(yield* savedOf(fixture, made.id, deviceOf(1))).toEqual({
          answers: [
            { question: second.id, response: ["option-2"], version: 1 },
          ],
          flagged: [second.id],
        });
      })
  );

  it.effect("refuses the paper to a device that does not own the attempt", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      yield* enterOk(fixture, {
        deviceId: deviceOf(1),
        sittingId: made.id,
        token: made.token,
      });
      const failure = yield* paperOf(fixture, made.id, deviceOf(2)).pipe(
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "SecondDevice" });
    })
  );

  it.effect("refuses the paper to a device that a proctor retired", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const entered = yield* enterOk(fixture, {
        deviceId: deviceOf(1),
        sittingId: made.id,
        token: made.token,
      });
      yield* fixture.as("teacher").mutation(allowDevice, {
        attemptId: entered.attempt,
        sittingId: made.id,
        slug: nf,
      });
      const failure = yield* paperOf(fixture, made.id, deviceOf(1)).pipe(
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "DeviceRetired" });
    })
  );

  it.effect(
    "reads the paper of a locked attempt, so its navigator stays on screen, while the answers stay closed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.as("teacher").mutation(lock, {
          attemptId: entered.attempt,
          reason: "other",
          sittingId: made.id,
          slug: nf,
        });
        const paper = yield* paperOf(fixture, made.id, deviceOf(1));
        expect(Arr.map(paper.questions, (question) => question.number)).toEqual(
          [1]
        );
      })
  );

  it.effect("refuses the paper once the attempt's deadline has passed", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      yield* enterOk(fixture, {
        deviceId: deviceOf(1),
        sittingId: made.id,
        token: made.token,
      });
      vi.setSystemTime(CLOSES);
      const failure = yield* paperOf(fixture, made.id, deviceOf(1)).pipe(
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "AttemptClosed" });
    })
  );

  it.effect(
    "refuses the paper of a suspended school, which locks its sittings",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.run(suspend(fixture.tenants.nf));
        const failure = yield* paperOf(fixture, made.id, deviceOf(1)).pipe(
          Effect.flip
        );
        expect(failure).toMatchObject({ _tag: "SittingLocked" });
      })
  );

  it.effect(
    "refuses the paper to a student who holds no attempt in the sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const failure = yield* paperOf(fixture, made.id, deviceOf(1)).pipe(
          Effect.flip
        );
        expect(failure).toMatchObject({ _tag: "NotInSitting" });
      })
  );

  it.effect(
    "refuses the paper of a locked attempt once its deadline has passed, as a closed attempt",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.as("teacher").mutation(lock, {
          attemptId: entered.attempt,
          reason: "other",
          sittingId: made.id,
          slug: nf,
        });
        vi.setSystemTime(CLOSES);
        const failure = yield* paperOf(fixture, made.id, deviceOf(1)).pipe(
          Effect.flip
        );
        expect(failure).toMatchObject({ _tag: "AttemptClosed" });
      })
  );
});
