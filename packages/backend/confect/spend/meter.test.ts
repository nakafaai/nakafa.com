import { RegisteredFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { metered, meterOf } from "@repo/backend/confect/spend/meter";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { recordingMeter } from "@repo/backend/test/spend";
import { Array as Arr, Effect, Fiber, Layer } from "effect";

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
    const t = createConvexTestWithBetterAuth();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        authId: "auth-meter",
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
          // A ceiling above what the free month has left holds the rest of it.
          const rest = yield* metered(
            "chat",
            10_000_000,
            Effect.succeed("rest"),
            () => 775_000 - 1875
          );
          const refused = yield* Effect.flip(
            metered("chat", 1, Effect.succeed("never"), () => 0)
          );
          return { answered, refused: refused._tag, rest };
        }).pipe(
          Effect.provide(
            Layer.provide(
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
});
