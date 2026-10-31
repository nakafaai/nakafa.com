import { assert, describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { writeTryoutSetProgress } from "@repo/backend/confect/tryouts/progress/write";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { inMutation } from "@repo/backend/test/client";
import {
  TRYOUT_NOW,
  type TryoutWorld,
  tryoutWorld,
} from "@repo/backend/test/tryout/world";
import { ConvexError } from "convex/values";
import { Effect, Struct } from "effect";

type ProgressInput = Parameters<typeof writeTryoutSetProgress>[0];

/** Reads one attempt row as the engine reads it. */
const readAttempt = (world: TryoutWorld, attemptId: Id<"tryoutAttempts">) =>
  world.run(
    Effect.flatMap(DatabaseReader, (database) =>
      database.table("tryoutAttempts").get(attemptId)
    ).pipe(Effect.orDie)
  );

/** Starts one attempt and returns its row, with its in-progress set progress already written. */
const seedAttempt = Effect.gen(function* () {
  const world = yield* tryoutWorld();
  const { attemptId } = yield* world.start();
  return { attempt: yield* readAttempt(world, attemptId), world };
});

/** Writes one progress row in a mutation, after `arrange` changed its transaction. */
const write = (
  world: TryoutWorld,
  input: Omit<ProgressInput, "updatedAt"> & { readonly updatedAt?: number },
  arrange: (ctx: MutationCtx) => Promise<unknown> = async () => undefined
) =>
  Effect.promise(() =>
    world.t.mutation(async (ctx) => {
      await arrange(ctx);
      return await inMutation(() =>
        writeTryoutSetProgress({ updatedAt: TRYOUT_NOW, ...input })
      )(ctx);
    })
  );

describe("tryouts/progress", () => {
  it.effect(
    "keeps only the set's latest attempt, by start time, with its workflow rank",
    () =>
      Effect.gen(function* () {
        const { attempt, world } = yield* seedAttempt;
        yield* write(world, {
          attempt,
          publishedScore: 75,
          status: "completed",
          updatedAt: TRYOUT_NOW + 1,
        });
        const latestId = yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            ctx.db.insert("tryoutAttempts", {
              ...Struct.omit(attempt, ["_creationTime", "_id"]),
              attemptNumber: 2,
              startedAt: attempt.startedAt + 1,
              status: "expired",
            })
          )
        );
        const latest = yield* readAttempt(world, latestId);
        yield* write(world, {
          attempt: latest,
          publishedScore: 50,
          status: "expired",
          updatedAt: TRYOUT_NOW + 2,
        });
        yield* write(world, {
          attempt,
          publishedScore: null,
          status: "in-progress",
          updatedAt: TRYOUT_NOW + 3,
        });
        expect(
          yield* Effect.promise(() =>
            world.t.query((ctx) => ctx.db.query("tryoutSetProgress").collect())
          )
        ).toMatchObject([
          {
            attemptNumber: 2,
            latestAttemptId: latest._id,
            publishedScore: 50,
            status: "expired",
            statusRank: 3,
          },
        ]);
      })
  );

  it.effect(
    "refuses running progress with a score and finished progress without one",
    () =>
      Effect.gen(function* () {
        const { attempt, world } = yield* seedAttempt;
        for (const [input, code] of [
          [
            { publishedScore: 80, status: "in-progress" },
            "TRYOUT_ACTIVE_PROGRESS_HAS_SCORE",
          ],
          [
            { publishedScore: null, status: "completed" },
            "TRYOUT_TERMINAL_PROGRESS_SCORE_REQUIRED",
          ],
        ] as const) {
          yield* Effect.promise(() =>
            expect(
              world.t.mutation((ctx) =>
                inMutation(() =>
                  writeTryoutSetProgress({
                    attempt,
                    updatedAt: TRYOUT_NOW,
                    ...input,
                  })
                )(ctx)
              )
            ).rejects.toMatchObject({ code })
          );
        }
      })
  );

  it.effect.each([
    new ConvexError({
      code: "PROGRESS_STORAGE_LIMIT",
      message: "Storage limit reached.",
    }),
    new Error("Storage unavailable."),
  ])(
    "masks a storage failure as a typed progress failure without partial progress",
    (cause) =>
      Effect.gen(function* () {
        const { attempt, world } = yield* seedAttempt;
        yield* Effect.promise(() =>
          expect(
            world.t.mutation(async (ctx) => {
              const progress = await ctx.db.query("tryoutSetProgress").unique();
              assert.ok(progress);
              await ctx.db.delete("tryoutSetProgress", progress._id);
              vi.spyOn(ctx.db, "insert").mockRejectedValueOnce(cause);
              return await inMutation(() =>
                writeTryoutSetProgress({
                  attempt,
                  publishedScore: null,
                  status: "in-progress",
                  updatedAt: TRYOUT_NOW,
                })
              )(ctx);
            })
          ).rejects.toMatchObject({
            code: "TRYOUT_PROGRESS_WRITE_FAILED",
            message: "Unable to update try-out progress.",
          })
        );
        expect(
          yield* Effect.promise(() =>
            world.t.query((ctx) => ctx.db.query("tryoutSetProgress").collect())
          )
        ).toHaveLength(1);
      })
  );
});
