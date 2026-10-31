import type { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import type databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  loadAttemptResponses,
  loadSectionResponseIndex,
} from "@repo/backend/confect/tryouts/runtime/response";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  choiceGrade,
  insertAnswer,
  seedTryoutGate,
} from "@repo/backend/test/tryout/gate";
import { Array as Arr, Effect, Struct } from "effect";

type MutationServices = RegisteredConvexFunction.MutationServices<
  typeof databaseSchema
>;

/** The seeded attempt with section A running, its stored rows, and helpers that change and load them. */
const seedLoaded = Effect.gen(function* () {
  const world = yield* seedTryoutGate;
  /** Reads the attempt, its running section, and its places in order. */
  const read = world.run(
    Effect.gen(function* () {
      const database = yield* DatabaseReader;
      return {
        attempt: yield* database.table("tryoutAttempts").get(world.attemptId),
        placements: yield* database
          .table("tryoutAttemptPlacements")
          .index(
            "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
            (query) => query.eq("tryoutAttemptId", world.attemptId)
          )
          .collect(),
        section: yield* database
          .table("tryoutSectionAttempts")
          .get(world.sectionAttemptId),
      };
    }).pipe(Effect.orDie)
  );
  return {
    ...(yield* read),
    /** Runs one direct change against the stored rows. */
    change: (edit: (ctx: MutationCtx) => Promise<unknown>) =>
      Effect.promise(() => world.t.mutation(edit)),
    /** The code a load fails with, read inside its transaction. */
    codeOf: <A, E extends { readonly code: string }>(
      load: Effect.Effect<A, E, MutationServices>
    ) =>
      world.run(
        load.pipe(
          Effect.flip,
          Effect.map(({ code }) => code)
        )
      ),
    world,
  };
});

describe("tryouts/runtime/response", () => {
  it.effect(
    "refuses more stored answers than a section or an attempt has questions",
    () =>
      Effect.gen(function* () {
        const { attempt, change, codeOf, placements, section, world } =
          yield* seedLoaded;
        const sectionPlaces = Arr.filter(
          placements,
          ({ sectionKey }) => sectionKey === "section-a"
        );
        yield* change(async (ctx) => {
          for (const _ of [1, 2, 3]) {
            await insertAnswer(
              ctx,
              world,
              world.sectionAttemptId,
              ["option-1"],
              choiceGrade(false)
            );
          }
        });
        expect(
          yield* codeOf(
            loadSectionResponseIndex(attempt, section, sectionPlaces)
          )
        ).toBe("TRYOUT_RESPONSE_COUNT_EXCEEDED");
        yield* change((ctx) =>
          insertAnswer(
            ctx,
            world,
            world.sectionAttemptId,
            ["option-1"],
            choiceGrade(false)
          )
        );
        expect(
          yield* codeOf(loadAttemptResponses(attempt, placements, "partial"))
        ).toBe("TRYOUT_RESPONSE_COUNT_EXCEEDED");
      })
  );

  it.effect(
    "refuses section attempts that outnumber, miss, repeat or differ from the frozen sections",
    () =>
      Effect.gen(function* () {
        const { attempt, change, codeOf, placements, section, world } =
          yield* seedLoaded;
        const load = (coverage: "complete" | "partial") =>
          codeOf(loadAttemptResponses(attempt, placements, coverage));
        expect(yield* load("complete")).toBe(
          "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH"
        );
        const copy = Struct.omit(section, ["_creationTime", "_id"]);
        for (const fields of [
          { sectionKey: "section-z" },
          {},
          { sectionKey: "section-b" },
          { sectionKey: "section-b", sectionOrder: 2 },
        ]) {
          const copyId = yield* Effect.promise(() =>
            world.t.mutation((ctx) =>
              ctx.db.insert("tryoutSectionAttempts", { ...copy, ...fields })
            )
          );
          expect(yield* load("partial")).toBe(
            "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH"
          );
          yield* change((ctx) =>
            ctx.db.delete("tryoutSectionAttempts", copyId)
          );
        }
        yield* change(async (ctx) => {
          await ctx.db.insert("tryoutSectionAttempts", {
            ...copy,
            sectionKey: "section-b",
            sectionOrder: 2,
            totalQuestions: 1,
          });
          await ctx.db.insert("tryoutSectionAttempts", copy);
        });
        expect(yield* load("partial")).toBe(
          "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH"
        );
      })
  );
});
