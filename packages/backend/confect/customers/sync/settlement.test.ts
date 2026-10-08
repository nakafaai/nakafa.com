import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { settleCustomerSync } from "@repo/backend/confect/customers/sync/settlement";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Effect, Schema } from "effect";

/** Creates observable cleanup operations for settlement tests. */
function createOperations() {
  return {
    deleteLocalCustomer: vi.fn(() => Effect.void),
    deletePolarCustomer: vi.fn(() => Effect.void),
  };
}

/** Creates real typed Convex IDs without test-only assertions. */
const createSettlementIds = Effect.fn("customers.sync.test.createIds")(
  function* () {
    const confect = yield* Confect;
    return yield* confect.run(
      Effect.gen(function* () {
        const writer = yield* DatabaseWriter;
        const userId = yield* writer.table("users").insert({
          authId: "auth-customer-settlement",
          credits: 0,
          creditsResetAt: 1,
          email: "customer-settlement@example.com",
          name: "Customer Settlement",
          plan: "free",
        });
        const customerId = yield* writer.table("customers").insert({
          externalId: "auth-customer-settlement",
          id: "polar-customer-settlement",
          metadata: {},
          userId,
        });
        return {
          customerId,
          userId,
        };
      }),
      Schema.Struct({ customerId: Id("customers"), userId: Id("users") })
    );
  }
);
describe("customers/sync/settlement", () => {
  it.effect("returns the stored customer without cleanup", () =>
    Effect.gen(function* () {
      const { customerId, userId } = yield* createSettlementIds();
      const operations = createOperations();
      expect(
        yield* settleCustomerSync(
          {
            customerId,
            kind: "stored",
          },
          userId,
          operations
        )
      ).toBe(customerId);
      expect(operations.deletePolarCustomer).not.toHaveBeenCalled();
      expect(operations.deleteLocalCustomer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(confectLayer))
  );
  it.effect(
    "preserves Polar and local state during cancelable preparation",
    () =>
      Effect.gen(function* () {
        const { userId } = yield* createSettlementIds();
        const operations = createOperations();
        const failure = yield* settleCustomerSync(
          {
            kind: "prepared",
          },
          userId,
          operations
        ).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "UserNotFound",
          code: "USER_NOT_FOUND",
        });
        expect(operations.deletePolarCustomer).not.toHaveBeenCalled();
        expect(operations.deleteLocalCustomer).not.toHaveBeenCalled();
      }).pipe(Effect.provide(confectLayer))
  );
  it.effect.each([
    {
      kind: "deleted",
    },
    {
      kind: "missing",
    },
  ] as const)("cleans irreversible $kind state", (result) =>
    Effect.gen(function* () {
      const { userId } = yield* createSettlementIds();
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
    }).pipe(Effect.provide(confectLayer))
  );
});
