import { assert, describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  readSectionCompletion,
  requireFinalSectionAttempts,
} from "@repo/backend/confect/tryouts/runtime/completion";
import { seedTryoutGate } from "@repo/backend/test/tryout/gate";
import { Effect, Struct } from "effect";

/** The seeded attempt, its running section A, and a second running section attempt for section B. */
const seedRunning = Effect.gen(function* () {
  const world = yield* seedTryoutGate;
  const otherId = yield* Effect.promise(() =>
    world.t.mutation(async (ctx) => {
      const section = await ctx.db.get(
        "tryoutSectionAttempts",
        world.sectionAttemptId
      );
      assert.ok(section, "Expected the running section.");
      return ctx.db.insert("tryoutSectionAttempts", {
        ...Struct.omit(section, ["_creationTime", "_id"]),
        sectionKey: "section-b",
        sectionOrder: 2,
      });
    })
  );
  return yield* world.run(
    Effect.gen(function* () {
      const database = yield* DatabaseReader;
      const sections = database.table("tryoutSectionAttempts");
      return {
        attempt: yield* database.table("tryoutAttempts").get(world.attemptId),
        other: yield* sections.get(otherId),
        section: yield* sections.get(world.sectionAttemptId),
      };
    }).pipe(Effect.orDie)
  );
});

/** The code a completion check fails with. */
const codeOf = <A, E extends { readonly code: string }>(
  check: Effect.Effect<A, E>
) =>
  check.pipe(
    Effect.flip,
    Effect.map(({ code }) => code)
  );

describe("tryouts/runtime/completion", () => {
  it.effect(
    "completes a running section, and the attempt with its last section",
    () =>
      Effect.gen(function* () {
        const { attempt, section } = yield* seedRunning;
        expect(yield* readSectionCompletion(attempt, section)).toMatchObject({
          completedSectionKeys: ["section-a"],
          completesAttempt: false,
        });
        expect(
          yield* readSectionCompletion(
            { ...attempt, completedSectionKeys: ["section-b"] },
            section
          )
        ).toMatchObject({
          completedSectionKeys: ["section-b", "section-a"],
          completesAttempt: true,
        });
      })
  );

  it.effect(
    "refuses a section that is not running, and completed keys that are foreign, repeated or already hold the section",
    () =>
      Effect.gen(function* () {
        const { attempt, section } = yield* seedRunning;
        expect(
          yield* codeOf(
            readSectionCompletion(attempt, { ...section, status: "completed" })
          )
        ).toBe("TRYOUT_SECTION_NOT_ACTIVE");
        for (const completedSectionKeys of [
          ["section-z"],
          ["section-b", "section-b"],
          ["section-a"],
        ]) {
          expect(
            yield* codeOf(
              readSectionCompletion(
                { ...attempt, completedSectionKeys },
                section
              )
            )
          ).toBe("TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH");
        }
      })
  );

  it.effect(
    "finishes an attempt only while no other section attempt is still running",
    () =>
      Effect.gen(function* () {
        const { other, section } = yield* seedRunning;
        yield* requireFinalSectionAttempts(section, [
          section,
          { ...other, status: "completed" },
        ]);
        expect(
          yield* codeOf(requireFinalSectionAttempts(section, [section, other]))
        ).toBe("TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH");
      })
  );
});
