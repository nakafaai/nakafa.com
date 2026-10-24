import { describe, expect, it } from "@effect/vitest";
import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { examBy, examRows } from "@repo/backend/test/exams";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const clear = refs.internal.exams.language.clear;

describe("exams/language clear", () => {
  it.effect(
    "removes the language from each exam that holds one, once, and leaves the other exams as they are",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const legacy = yield* examBy(fixture, "teacher", "PTS Biologi");
        const current = yield* examBy(fixture, "admin", "PAS Fisika");
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("exams").patch(legacy.id, {
              language: DeliveryLanguageSchema.make("id"),
            })
          ).pipe(Effect.orDie)
        );
        const holding = Arr.filter(
          yield* fixture.run(examRows),
          (row) => row.language !== undefined
        );

        const first = yield* fixture.internal.mutation(clear, {});
        const repeat = yield* fixture.internal.mutation(clear, {
          cursor: first.continueCursor,
        });
        const again = yield* fixture.internal.mutation(clear, {});
        const rows = yield* fixture.run(examRows);

        expect(Arr.map(holding, (row) => row._id)).toEqual([legacy.id]);
        expect(first).toEqual({
          cleared: 1,
          continueCursor: expect.any(String),
          done: true,
        });
        expect(repeat).toEqual({
          cleared: 0,
          continueCursor: expect.any(String),
          done: true,
        });
        expect(again.cleared).toBe(0);
        expect(Arr.some(rows, (row) => row.language !== undefined)).toBe(false);
        expect(Arr.map(rows, (row) => row._id)).toEqual([
          legacy.id,
          current.id,
        ]);
        expect(Arr.map(rows, (row) => row.title)).toEqual([
          "PTS Biologi",
          "PAS Fisika",
        ]);
      })
  );
});
