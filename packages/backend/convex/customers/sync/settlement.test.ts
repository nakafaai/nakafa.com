import { settleCustomerSync } from "@repo/backend/convex/customers/sync/settlement";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

/** Creates observable cleanup operations for settlement tests. */
function createOperations() {
  return {
    deleteLocalCustomer: vi.fn(() => Effect.void),
    deletePolarCustomer: vi.fn(() => Effect.void),
  };
}

/** Creates real typed Convex IDs without test-only assertions. */
function createSettlementIds() {
  const t = convexTest(schema, convexModules);

  return t.mutation(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      authId: "auth-customer-settlement",
      credits: 0,
      creditsResetAt: 1,
      email: "customer-settlement@example.com",
      name: "Customer Settlement",
      plan: "free",
    });
    const customerId = await ctx.db.insert("customers", {
      externalId: "auth-customer-settlement",
      id: "polar-customer-settlement",
      metadata: {},
      userId,
    });

    return { customerId, userId };
  });
}

describe("customers/sync/settlement", () => {
  it("returns the stored customer without cleanup", async () => {
    const { customerId, userId } = await createSettlementIds();
    const operations = createOperations();

    await expect(
      Effect.runPromise(
        settleCustomerSync({ customerId, kind: "stored" }, userId, operations)
      )
    ).resolves.toBe(customerId);
    expect(operations.deletePolarCustomer).not.toHaveBeenCalled();
    expect(operations.deleteLocalCustomer).not.toHaveBeenCalled();
  });

  it("preserves Polar and local state during cancelable preparation", async () => {
    const { userId } = await createSettlementIds();
    const operations = createOperations();

    const failure = await Effect.runPromise(
      settleCustomerSync({ kind: "prepared" }, userId, operations).pipe(
        Effect.flip
      )
    );

    expect(failure).toMatchObject({
      _tag: "UserNotFound",
      code: "USER_NOT_FOUND",
    });
    expect(operations.deletePolarCustomer).not.toHaveBeenCalled();
    expect(operations.deleteLocalCustomer).not.toHaveBeenCalled();
  });

  it.each([{ kind: "deleted" }, { kind: "missing" }] as const)(
    "cleans irreversible $kind state",
    async (result) => {
      const { userId } = await createSettlementIds();
      const operations = createOperations();

      const failure = await Effect.runPromise(
        settleCustomerSync(result, userId, operations).pipe(Effect.flip)
      );

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
    }
  );
});
