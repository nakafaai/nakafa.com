import { describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { setAssessmentFlag } from "@repo/backend/confect/assessment/flags";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

/** The flag rows of the table, read in creation order. */
const rows = (fixture: Effect.Success<typeof tenancyFixture>) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("assessmentFlags")
        .index("by_creation_time")
        .take(100)
        .pipe(Effect.orDie)
    )
  );

describe("assessment/flags", () => {
  it.effect(
    "writes one row for a question flagged once, and deletes it when unflagged",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const flag = (flagged: boolean) =>
          fixture.run(
            setAssessmentFlag({
              attempt: "attempt-a",
              flagged,
              kind: "sitting",
              question: "question-a",
            })
          );
        yield* flag(true);
        yield* flag(true);
        expect(yield* rows(fixture)).toEqual([
          expect.objectContaining({
            attempt: "attempt-a",
            kind: "sitting",
            question: "question-a",
          }),
        ]);
        yield* flag(false);
        expect(yield* rows(fixture)).toEqual([]);
        yield* flag(false);
        expect(yield* rows(fixture)).toEqual([]);
      })
  );

  it.effect("keeps the flags of two attempts, and of two kinds, apart", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(
        setAssessmentFlag({
          attempt: "attempt-a",
          flagged: true,
          kind: "sitting",
          question: "question-a",
        })
      );
      yield* fixture.run(
        setAssessmentFlag({
          attempt: "attempt-b",
          flagged: true,
          kind: "tryout",
          question: "question-a",
        })
      );
      yield* fixture.run(
        setAssessmentFlag({
          attempt: "attempt-a",
          flagged: false,
          kind: "sitting",
          question: "question-b",
        })
      );
      expect(yield* rows(fixture)).toHaveLength(2);
    })
  );
});
