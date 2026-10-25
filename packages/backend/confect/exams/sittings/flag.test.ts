import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import {
  CLOSES_AT as CLOSES,
  deviceOf,
  enterOk,
  openedSitting,
  type SittingFixture,
} from "@repo/backend/test/sittings";
import {
  suspend,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { flag, paper } = refs.public.exams.sittings;

/** A question of the exam that a test sitting holds. */
type QuestionId = GenericId.GenericId<"examQuestions">;

/** Flags or unflags one question, as the bound device of the student. */
const flagAs = (
  fixture: SittingFixture,
  args: {
    deviceId: string;
    flagged: boolean;
    questionId: QuestionId;
    sittingId: GenericId.GenericId<"examSittings">;
  }
) => fixture.as("student").mutation(flag, { ...args, slug: nf });

/** The number of flag rows that the table holds, which a test reads before and after a change. */
const flagRows = (fixture: SittingFixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("assessmentFlags")
        .index("by_creation_time")
        .take(100)
        .pipe(Effect.orDie)
    )
  );

/** A sitting that the student has entered from device 1, with the first question of its exam. */
const enteredSitting = (fixture: SittingFixture) =>
  Effect.gen(function* () {
    const made = yield* openedSitting(fixture, "PTS");
    yield* enterOk(fixture, {
      deviceId: deviceOf(1),
      sittingId: made.id,
      token: made.token,
    });
    const { questions } = yield* fixture
      .as("student")
      .query(paper, { deviceId: deviceOf(1), sittingId: made.id, slug: nf });
    return { question: questions[0].id, sittingId: made.id };
  });

describe("exams/sittings flag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "flags a question once, shows the flag on the paper, and unflags it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { question, sittingId } = yield* enteredSitting(fixture);
        yield* flagAs(fixture, {
          deviceId: deviceOf(1),
          flagged: true,
          questionId: question,
          sittingId,
        });
        yield* flagAs(fixture, {
          deviceId: deviceOf(1),
          flagged: true,
          questionId: question,
          sittingId,
        });
        expect(yield* flagRows(fixture)).toHaveLength(1);
        const flagged = yield* fixture
          .as("student")
          .query(paper, { deviceId: deviceOf(1), sittingId, slug: nf });
        expect(flagged.questions[0]).toMatchObject({ flagged: true });
        yield* flagAs(fixture, {
          deviceId: deviceOf(1),
          flagged: false,
          questionId: question,
          sittingId,
        });
        yield* flagAs(fixture, {
          deviceId: deviceOf(1),
          flagged: false,
          questionId: question,
          sittingId,
        });
        expect(yield* flagRows(fixture)).toHaveLength(0);
      })
  );

  it.effect("refuses a flag from a device that does not own the attempt", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { question, sittingId } = yield* enteredSitting(fixture);
      const failure = yield* flagAs(fixture, {
        deviceId: deviceOf(2),
        flagged: true,
        questionId: question,
        sittingId,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "SecondDevice" });
      expect(yield* flagRows(fixture)).toHaveLength(0);
    })
  );

  it.effect(
    "refuses a flag on a question that the sitting's exam does not hold",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { sittingId } = yield* enteredSitting(fixture);
        const other = yield* teacherExam(fixture, "Lain");
        const failure = yield* flagAs(fixture, {
          deviceId: deviceOf(1),
          flagged: true,
          questionId: other.questions[0].id,
          sittingId,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "QuestionNotInExam" });
      })
  );

  it.effect("refuses a flag once the deadline has passed", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { question, sittingId } = yield* enteredSitting(fixture);
      vi.setSystemTime(CLOSES);
      const failure = yield* flagAs(fixture, {
        deviceId: deviceOf(1),
        flagged: true,
        questionId: question,
        sittingId,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "AttemptClosed" });
    })
  );

  it.effect("refuses a flag to a school that is suspended", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { question, sittingId } = yield* enteredSitting(fixture);
      yield* fixture.run(suspend(fixture.tenants.nf));
      const failure = yield* flagAs(fixture, {
        deviceId: deviceOf(1),
        flagged: true,
        questionId: question,
        sittingId,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "SittingLocked" });
    })
  );

  it.effect(
    "refuses a flag from a student who holds no attempt in the sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const failure = yield* flagAs(fixture, {
          deviceId: deviceOf(1),
          flagged: true,
          questionId: (yield* teacherExam(fixture, "Lain")).questions[0].id,
          sittingId: made.id,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "NotInSitting" });
      })
  );
});
