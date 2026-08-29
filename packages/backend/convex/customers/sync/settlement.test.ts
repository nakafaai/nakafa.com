import { describe, expect, it, vi } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { settleCustomerSync } from "@repo/backend/convex/customers/sync/settlement";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Creates observable cleanup operations for settlement tests. */
function createOperations() {
  return {
    deleteLocalCustomer: vi.fn(() => Effect.void),
    deletePolarCustomer: vi.fn(() => Effect.void),
  };
}

/** Creates real typed Convex IDs without test-only assertions. */
const createSettlementIds = Effect.fn("customers.sync.test.createIds")(
  function* (ctx: MutationCtx) {
    const userId = yield* Effect.promise(() =>
      ctx.db.insert("users", {
        authId: "auth-customer-settlement",
        credits: 0,
        creditsResetAt: 1,
        email: "customer-settlement@example.com",
        name: "Customer Settlement",
        plan: "free",
      })
    );
    const customerId = yield* Effect.promise(() =>
      ctx.db.insert("customers", {
        externalId: "auth-customer-settlement",
        id: "polar-customer-settlement",
        metadata: {},
        userId,
      })
    );

    return { customerId, userId };
  }
);

describe("customers/sync/settlement", () => {
  it.effect("returns the stored customer without cleanup", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const { customerId, userId } = yield* Effect.promise(() =>
        t.mutation((ctx) => runConvexProgram(createSettlementIds(ctx)))
      );
      const operations = createOperations();

      expect(
        yield* settleCustomerSync(
          { customerId, kind: "stored" },
          userId,
          operations
        )
      ).toBe(customerId);
      expect(operations.deletePolarCustomer).not.toHaveBeenCalled();
      expect(operations.deleteLocalCustomer).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "preserves Polar and local state during cancelable preparation",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const { userId } = yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(createSettlementIds(ctx)))
        );
        const operations = createOperations();

        const failure = yield* settleCustomerSync(
          { kind: "prepared" },
          userId,
          operations
        ).pipe(Effect.flip);

        expect(failure).toMatchObject({
          _tag: "UserNotFound",
          code: "USER_NOT_FOUND",
        });
        expect(operations.deletePolarCustomer).not.toHaveBeenCalled();
        expect(operations.deleteLocalCustomer).not.toHaveBeenCalled();
      })
  );

  it.effect.each([{ kind: "deleted" }, { kind: "missing" }] as const)(
    "cleans irreversible $kind state",
    (result) =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const { userId } = yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(createSettlementIds(ctx)))
        );
        const operations = createOperations();

        const failure = yield* settleCustomerSync(
          result,
          userId,
          operations
        ).pipe(Effect.flip);

        expect(failure).toMatchObject({
          _tag: "UserNotFound",
          code: "USER_NOT_FOUND",
        });
        expect(operations.deletePolarCustomer).toHaveBeenCalledOnce();
        expect(operations.deleteLocalCustomer).toHaveBeenCalledOnce();
        expect(
          operations.deletePolarCustomer.mock.invocationCallOrder[0]
        ).toBeLessThan(
          operations.deleteLocalCustomer.mock.invocationCallOrder[0] ?? 0
        );
      })
  );
});
