import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  CLOSES_AT,
  deviceOf,
  keyedSchool,
  seedAttempt,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const load = refs.internal.exams.seed.load;
const answers = refs.internal.exams.seed.answers;

describe("exams seed answers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    vi.stubEnv("ACCEPTANCE_SEED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect("refuses to read answers outside the acceptance runtime", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      vi.stubEnv("ACCEPTANCE_SEED", "false");
      const refusal = yield* fixture.internal
        .query(answers, { paginationOpts: { cursor: null, numItems: 10 } })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({ _tag: "SeedRefused" });
    })
  );

  it.effect(
    "reads every stored answer page by page in the order it was written, with only what the audit checks",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const made = yield* fixture.internal.mutation(load, {
          questions: 3,
          rooms: 1,
          slug: nf,
        });
        const room = yield* Effect.fromOption(Arr.head(made.sittings));
        const attempt = yield* seedAttempt(fixture, {
          deadline: CLOSES_AT,
          deviceId: deviceOf(1),
          person: fixture.people.student.personId,
          sittingId: room.id,
          state: "inProgress",
        });
        const questions = yield* fixture.run(
          Effect.gen(function* () {
            const exam = yield* (yield* DatabaseReader)
              .table("exams")
              .get(made.examId);
            const writer = yield* DatabaseWriter;
            yield* Effect.forEach(
              exam.questions,
              (question, index) =>
                writer.table("examAnswers").insert({
                  answeredAt: TENANCY_NOW + index,
                  attempt,
                  question,
                  response: [],
                  tenantId: fixture.tenants.nf,
                  version: index + 1,
                }),
              { discard: true }
            );
            return exam.questions;
          }).pipe(Effect.orDie)
        );

        const first = yield* fixture.internal.query(answers, {
          paginationOpts: { cursor: null, numItems: 2 },
        });
        expect(first.isDone).toBe(false);
        expect(first.page).toEqual([
          { attempt, question: questions[0], response: [], version: 1 },
          { attempt, question: questions[1], response: [], version: 2 },
        ]);
        const rest = yield* fixture.internal.query(answers, {
          paginationOpts: { cursor: first.continueCursor, numItems: 2 },
        });
        expect(rest.isDone).toBe(true);
        expect(Arr.map(rest.page, (row) => row.version)).toEqual([3]);
      })
  );
});
