import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { CreditStateError } from "@repo/backend/confect/credits/spec";
import {
  getCreditResetGrantTransaction,
  getCurrentCreditResetTimestamp,
  getEffectiveCreditStateForResetTimestamp,
  getStoredCreditResetTimestamp,
  resolveCurrentCreditResetTimestamp,
  resolveEffectiveCreditState,
  upsertStoredCreditResetTimestamp,
} from "@repo/backend/confect/credits/state";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Effect, Exit, Result } from "effect";

const day = Date.UTC(2026, 3, 2);
const previousDay = Date.UTC(2026, 3, 1);
describe("credit period and balance", () => {
  it.effect(
    "rejects duplicate plan boundaries instead of granting against an arbitrary period",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        yield* confect.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            yield* writer.table("creditResetPeriods").insert({
              plan: "free",
              resetAt: previousDay,
            });
            yield* writer.table("creditResetPeriods").insert({
              plan: "free",
              resetAt: day,
            });
            const result = yield* getStoredCreditResetTimestamp("free").pipe(
              Effect.result
            );
            expect(Result.isFailure(result)).toBe(true);
            if (Result.isFailure(result)) {
              expect(result.failure).toBeInstanceOf(CreditStateError);
              expect(result.failure.code).toBe("CREDIT_STATE_FAILED");
            }
          })
        );
      }).pipe(Effect.provide(confectLayer))
  );
  it.effect(
    "rolls back the transaction and preserves typed failure when storage rejects an update",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        yield* confect.run(
          upsertStoredCreditResetTimestamp("free", 100).pipe(Effect.asVoid)
        );
        const exit = yield* confect
          .run(
            Effect.gen(function* () {
              yield* upsertStoredCreditResetTimestamp("pro", 100);
              const ctx = yield* MutationCtx;
              vi.spyOn(ctx.db, "replace").mockRejectedValueOnce(
                new Error("private storage details")
              );
              yield* upsertStoredCreditResetTimestamp("free", 200).pipe(
                Effect.tapError((error) =>
                  Effect.sync(() => {
                    expect(error).toBeInstanceOf(CreditStateError);
                    expect(error).toMatchObject({
                      code: "CREDIT_STATE_FAILED",
                      message:
                        "Unable to read or update the credit reset period.",
                    });
                  })
                )
              );
            })
          )
          .pipe(Effect.exit);
        expect(Exit.isFailure(exit)).toBe(true);
        yield* confect.run(
          Effect.gen(function* () {
            expect(yield* getStoredCreditResetTimestamp("free")).toBe(100);
            expect(yield* getStoredCreditResetTimestamp("pro")).toBeNull();
          })
        );
      }).pipe(Effect.provide(confectLayer))
  );
  it("uses UTC day boundaries for free and month boundaries for pro", () => {
    const now = Date.UTC(2026, 3, 18, 18, 45, 12);
    expect(getCurrentCreditResetTimestamp("free", now)).toBe(
      Date.UTC(2026, 3, 18)
    );
    expect(getCurrentCreditResetTimestamp("pro", now)).toBe(
      Date.UTC(2026, 3, 1)
    );
  });
  it("keeps balances in the current reset window and replaces stale positive balances", () => {
    expect(
      getEffectiveCreditStateForResetTimestamp(
        {
          credits: 7,
          creditsResetAt: day,
          plan: "free",
        },
        day
      )
    ).toEqual({
      credits: 7,
      creditsResetAt: day,
    });
    expect(
      getEffectiveCreditStateForResetTimestamp(
        {
          credits: 99,
          creditsResetAt: previousDay,
          plan: "free",
        },
        day
      )
    ).toEqual({
      credits: 25,
      creditsResetAt: day,
    });
  });
  it.effect(
    "seeds a missing period, is idempotent, and updates its boundary",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        yield* confect.run(
          Effect.gen(function* () {
            expect(yield* getStoredCreditResetTimestamp("free")).toBeNull();
            yield* upsertStoredCreditResetTimestamp("free", previousDay);
            yield* upsertStoredCreditResetTimestamp("free", previousDay);
            const reader = yield* DatabaseReader;
            const periods = yield* reader
              .table("creditResetPeriods")
              .index("by_plan", (q) => q.eq("plan", "free"))
              .collect();
            expect(periods).toHaveLength(1);
            expect(periods[0]?.resetAt).toBe(previousDay);
            yield* upsertStoredCreditResetTimestamp("free", day);
            expect(yield* getStoredCreditResetTimestamp("free")).toBe(day);
          })
        );
      }).pipe(Effect.provide(confectLayer))
  );
  it.effect(
    "preserves an already current boundary and reconciles stale periods",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        yield* confect.run(
          Effect.gen(function* () {
            yield* upsertStoredCreditResetTimestamp("free", previousDay);
            expect(
              yield* resolveCurrentCreditResetTimestamp(
                "free",
                day + 36_000_000
              )
            ).toBe(day);
            expect(yield* getStoredCreditResetTimestamp("free")).toBe(day);
            expect(
              yield* resolveCurrentCreditResetTimestamp(
                "free",
                day + 36_000_000
              )
            ).toBe(day);
          })
        );
      }).pipe(Effect.provide(confectLayer))
  );
  it.effect(
    "keeps negative credit debt across a reset, including a missing initial period",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        yield* confect.run(
          Effect.gen(function* () {
            const user = {
              credits: -3,
              creditsResetAt: previousDay,
              plan: "free" as const,
            };
            expect(
              yield* resolveEffectiveCreditState(user, day + 36_000_000)
            ).toEqual({
              credits: 22,
              creditsResetAt: day,
            });
            expect(yield* getStoredCreditResetTimestamp("free")).toBe(day);
            yield* upsertStoredCreditResetTimestamp("free", previousDay);
            expect(
              yield* resolveEffectiveCreditState(user, day + 36_000_000)
            ).toEqual({
              credits: 22,
              creditsResetAt: day,
            });
          })
        );
      }).pipe(Effect.provide(confectLayer))
  );
  it("grants once per reset window while preserving the original debt in the ledger", () => {
    expect(
      getCreditResetGrantTransaction(
        {
          credits: -3,
          creditsResetAt: previousDay,
          plan: "free",
        },
        {
          credits: 22,
          creditsResetAt: day,
        }
      )
    ).toEqual({
      amount: 25,
      type: "daily-grant",
      balanceAfter: 22,
      metadata: {
        "previous-balance": -3,
        "previous-reset-at": previousDay,
        "reset-at": day,
      },
    });
    expect(
      getCreditResetGrantTransaction(
        {
          credits: 7,
          creditsResetAt: day,
          plan: "free",
        },
        {
          credits: 7,
          creditsResetAt: day,
        }
      )
    ).toBeNull();
  });
});
