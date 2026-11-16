import { RegisteredFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import spendInternal from "@repo/backend/confect/_generated/refs/spend.server";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { foldSpend } from "@repo/backend/confect/spend/ledger";
import { metered, meterOf } from "@repo/backend/confect/spend/meter";
import { createConvexTestWithAuth } from "@repo/backend/confect/test.helpers";
import { runInMutation } from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { recordingMeter } from "@repo/backend/test/spend";
import { Array as Arr, Effect, Fiber, Layer, MutableRef } from "effect";

/** When the test learner's credits were last reset. */
const NOW = Date.UTC(2026, 10, 7, 10);

describe("spend/meter", () => {
  it.effect("settles a call that succeeds to the cost of its result", () =>
    Effect.gen(function* () {
      const meter = recordingMeter();
      const result = yield* metered(
        "search",
        100,
        Effect.succeed(7),
        (seven) => seven * 3
      ).pipe(Effect.provide(meter.layer));
      expect(result).toBe(7);
      expect(meter.calls()).toEqual(["hold search 100", "settle 21"]);
    })
  );

  it.effect("settles a call that fails to its whole hold", () =>
    Effect.gen(function* () {
      const meter = recordingMeter();
      const failure = yield* Effect.flip(
        metered("scrape", 50, Effect.fail("boom"), () => 1)
      ).pipe(Effect.provide(meter.layer));
      expect(failure).toBe("boom");
      expect(meter.calls()).toEqual(["hold scrape 50", "settle 50"]);
    })
  );

  it.effect("settles an interrupted call to its whole hold", () =>
    Effect.gen(function* () {
      const meter = recordingMeter();
      const fiber = yield* metered("chat", 40, Effect.never, () => 1).pipe(
        Effect.provide(meter.layer),
        Effect.forkChild
      );
      yield* Effect.yieldNow;
      yield* Fiber.interrupt(fiber);
      expect(meter.calls()).toEqual(["hold chat 40", "settle 40"]);
    })
  );

  it("holds and settles through the escrow mutations of the claim", async () => {
    const t = createConvexTestWithAuth();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        credits: 0,
        creditsResetAt: NOW,
        email: "meter@example.com",
        mascot: MASCOT_CODE,
        name: "Meter",
        plan: "free",
      })
    );
    const outcome = await t.action((ctx) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const answered = yield* metered(
            "chat",
            45_625,
            Effect.succeed("answer"),
            () => 1875
          );
          const { runMutation } = yield* MutationRunner;
          // A hold reads the month as the minute's fold last counted it.
          yield* runMutation(spendInternal.escrow.fold, {});
          // A ceiling above what the free month has left holds the rest of it.
          const rest = yield* metered(
            "chat",
            10_000_000,
            Effect.succeed("rest"),
            () => 775_000 - 1875
          );
          yield* runMutation(spendInternal.escrow.fold, {});
          const refused = yield* Effect.flip(
            metered("chat", 1, Effect.succeed("never"), () => 0)
          );
          return { answered, refused: refused._tag, rest };
        }).pipe(
          Effect.provide(
            // The test folds through the action's own mutation runner too.
            Layer.provideMerge(
              meterOf({ kind: "learner", userId }),
              RegisteredFunction.actionLayer(confectSchema, ctx)
            )
          )
        )
      )
    );
    expect(outcome).toEqual({
      answered: "answer",
      refused: "SpendRefused",
      rest: "rest",
    });
    const rows = await t.run((ctx) => ctx.db.query("vendorSpend").collect());
    expect(
      Arr.map(rows, ({ calls, held, spent }) => ({ calls, held, spent }))
    ).toEqual([{ calls: 2, held: 0, spent: 775_000 }]);
  });

  it("holds and settles an action's calls at once, each on its own escrow, and the fold counts them all", async () => {
    const t = createConvexTestWithAuth();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        credits: 0,
        creditsResetAt: NOW,
        email: "turns@example.com",
        mascot: MASCOT_CODE,
        name: "Turns",
        plan: "free",
      })
    );
    const most = await t.action((ctx) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const open = MutableRef.make(0);
          const peak = MutableRef.make(0);
          const counted: typeof ctx = {
            ...ctx,
            runMutation: async (mutation, ...args) => {
              MutableRef.update(open, (count) => count + 1);
              MutableRef.update(peak, (count) =>
                Math.max(count, MutableRef.get(open))
              );
              const result = await ctx.runMutation(mutation, ...args);
              MutableRef.update(open, (count) => count - 1);
              return result;
            },
          };
          yield* Effect.forEach(
            Arr.range(1, 4),
            () => metered("chat", 1000, Effect.yieldNow, () => 500),
            { concurrency: "unbounded" }
          ).pipe(
            Effect.provide(
              Layer.provide(
                meterOf({ kind: "learner", userId }),
                RegisteredFunction.actionLayer(confectSchema, counted)
              )
            )
          );
          return MutableRef.get(peak);
        })
      )
    );
    // No lock: the calls write their own escrows side by side.
    expect(most).toBeGreaterThan(1);
    await t.run((ctx) => runInMutation(ctx, foldSpend()));
    const rows = await t.run((ctx) => ctx.db.query("vendorSpend").collect());
    expect(
      Arr.map(rows, ({ calls, held, spent }) => ({ calls, held, spent }))
    ).toEqual([{ calls: 4, held: 0, spent: 2000 }]);
  });
});
