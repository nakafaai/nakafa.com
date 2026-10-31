import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import { examRows } from "@repo/backend/test/exams";
import { keyedSchool, sittingRow } from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const load = refs.internal.exams.seed.load;

describe("exams seed load", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    vi.stubEnv("ACCEPTANCE_SEED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "refuses the seed outside the acceptance runtime, and writes no exam",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const before = yield* fixture.run(examRows);
        vi.stubEnv("ACCEPTANCE_SEED", "false");
        const refusal = yield* fixture.internal
          .mutation(load, { questions: 3, rooms: 2, slug: nf })
          .pipe(Effect.flip);
        expect(refusal).toMatchObject({ _tag: "SeedRefused" });
        expect(yield* fixture.run(examRows)).toHaveLength(before.length);
      })
  );

  it.effect(
    "seeds a keyed exam of numbered questions in order, and open rooms of it that close two hours later",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const made = yield* fixture.internal.mutation(load, {
          questions: 3,
          rooms: 2,
          slug: nf,
        });
        const questions = yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const exam = yield* reader
              .table("exams")
              .get(made.examId)
              .pipe(Effect.orDie);
            expect(exam.title).toBe("Ujian Beban");
            return yield* Effect.forEach(exam.questions, (id) =>
              reader.table("examQuestions").get(id).pipe(Effect.orDie)
            );
          })
        );
        expect(questions).toHaveLength(3);
        expect(Arr.every(questions, (question) => question.key !== null)).toBe(
          true
        );
        expect(Arr.map(made.sittings, (sitting) => sitting.room)).toEqual([
          "Ruang 01",
          "Ruang 02",
        ]);
        expect(made.sittings[0]?.token).not.toBe(made.sittings[1]?.token);
        const rooms = yield* Effect.forEach(made.sittings, (sitting) =>
          sittingRow(fixture, sitting.id)
        );
        expect(
          Arr.map(rooms, (room) => [room.state, room.closesAt - room.opensAt])
        ).toEqual([
          ["open", 2 * 60 * 60 * 1000],
          ["open", 2 * 60 * 60 * 1000],
        ]);
      })
  );
});
