import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  requireCustomer,
  syncCustomerForUser,
  syncOptionalCustomer,
} from "@repo/backend/convex/customers/sync/impl";
import { runConvexActionProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const polarGateway = vi.hoisted(() => ({
  createCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
  getCustomerByExternalId: vi.fn(),
  getCustomerById: vi.fn(),
  updateCustomer: vi.fn(),
  updateCustomerMetadata: vi.fn(),
}));
vi.mock("@repo/backend/convex/customers/polar/live", () => ({ polarGateway }));

/** Seeds a real local identity for customer synchronization. */
async function setup(linked = false) {
  const t = convexTest(schema, convexModules);
  const userId = await t.mutation(async (ctx) => {
    const id = await ctx.db.insert("users", {
      authId: "sync-auth",
      credits: 0,
      creditsResetAt: 0,
      email: "sync@example.com",
      name: "Sync User",
      plan: "free",
    });
    if (linked) {
      await ctx.db.insert("customers", {
        externalId: "sync-auth",
        id: "polar-sync",
        metadata: { userId: id },
        userId: id,
      });
    }
    return id;
  });
  const customer = {
    email: "sync@example.com",
    externalId: "sync-auth",
    id: "polar-sync",
    metadata: { userId },
    name: "Sync User",
  };
  polarGateway.getCustomerByExternalId.mockReturnValue(
    Effect.succeed(customer)
  );
  polarGateway.getCustomerById.mockReturnValue(Effect.succeed(customer));
  return { customer, t, userId };
}

describe("customer synchronization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    polarGateway.deleteCustomer.mockReturnValue(Effect.succeed(null));
  });

  it.each([false, true])(
    "reconciles optional and required customers with existing link %s",
    async (linked) => {
      const { customer, t, userId } = await setup(linked);
      const optional = await t.action((ctx) =>
        runConvexActionProgram(syncOptionalCustomer(ctx, userId))
      );
      const required = await t.action((ctx) =>
        runConvexActionProgram(requireCustomer(ctx, userId))
      );
      expect(optional).toStrictEqual(required);
      expect(required).toMatchObject({
        id: customer.id,
        externalId: customer.externalId,
        metadata: customer.metadata,
        userId,
      });
      expect(
        await t.query((ctx) =>
          ctx.db.get("customers", required.localCustomerId)
        )
      ).toMatchObject({
        id: customer.id,
        userId,
      });
    }
  );

  it("creates a required customer without a preexisting local link", async () => {
    const { t, userId } = await setup();
    const result = await t.action((ctx) =>
      runConvexActionProgram(requireCustomer(ctx, userId))
    );
    expect(result.id).toBe("polar-sync");
    expect(polarGateway.getCustomerById).not.toHaveBeenCalled();
  });

  it.each(["missing", "prepared", "deleted"])(
    "rejects unavailable %s users before contacting Polar",
    async (state) => {
      const { t, userId } = await setup();
      await t.mutation((ctx) =>
        state === "missing"
          ? ctx.db.delete("users", userId)
          : ctx.db.patch(
              "users",
              userId,
              state === "prepared"
                ? { deletionPreparedAt: 1 }
                : { deletedAt: 1 }
            )
      );
      expect(
        await t.action((ctx) =>
          runConvexActionProgram(syncOptionalCustomer(ctx, userId))
        )
      ).toBeNull();
      expect(
        await t.action((ctx) =>
          runConvexActionProgram(
            requireCustomer(ctx, userId).pipe(
              Effect.match({
                onFailure: (error) => ({ ...error, message: error.message }),
                onSuccess: () => null,
              })
            )
          )
        )
      ).toMatchObject({ _tag: "UserNotFound" });
      expect(polarGateway.getCustomerByExternalId).not.toHaveBeenCalled();
    }
  );

  it.each([null, undefined])(
    "binds missing Polar metadata with local ID %s",
    async (localCustomerId) => {
      const { customer, t, userId } = await setup();
      polarGateway.getCustomerByExternalId.mockReturnValue(
        Effect.succeed(null)
      );
      polarGateway.createCustomer.mockReturnValue(
        Effect.succeed({ ...customer, metadata: {} })
      );
      polarGateway.updateCustomerMetadata.mockReturnValue(
        Effect.succeed(customer)
      );
      const user = await t.query((ctx) => ctx.db.get("users", userId));
      expect(user).not.toBeNull();
      if (user === null) {
        return;
      }
      const result = await t.action((ctx) =>
        runConvexActionProgram(
          syncCustomerForUser(ctx, {
            ...(localCustomerId === undefined ? {} : { localCustomerId }),
            user,
          })
        )
      );
      expect(result.metadata).toStrictEqual({ userId });
      expect(polarGateway.createCustomer.mock.calls[0]?.[0]).not.toHaveProperty(
        "localCustomerId"
      );
      expect(polarGateway.updateCustomerMetadata).toHaveBeenCalledWith({
        polarCustomerId: customer.id,
        metadata: { userId },
      });
    }
  );

  it("cleans the Polar customer if the user disappears during reconciliation", async () => {
    const { customer, t, userId } = await setup();
    polarGateway.getCustomerByExternalId.mockReturnValue(
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          t.mutation((ctx) => ctx.db.delete("users", userId))
        );
        return customer;
      })
    );
    const result = await t.action((ctx) =>
      runConvexActionProgram(syncOptionalCustomer(ctx, userId))
    );
    expect(result).toBeNull();
    expect(polarGateway.deleteCustomer).toHaveBeenCalledWith(customer.id);
    expect(
      await t.query((ctx) =>
        ctx.db.query("customerDeletionTombstones").collect()
      )
    ).toMatchObject([{ polarCustomerId: customer.id }]);
  });

  it("preserves typed failures when loading local customer state", async () => {
    const { t, userId } = await setup();
    const failure = await t.action((ctx) => {
      vi.spyOn(ctx, "runQuery").mockRejectedValueOnce(
        new Error("query unavailable")
      );
      return runConvexActionProgram(
        requireCustomer(ctx, userId).pipe(
          Effect.match({
            onFailure: (error) => ({ ...error, message: error.message }),
            onSuccess: () => null,
          })
        )
      );
    });
    expect(failure).toMatchObject({
      _tag: "CustomerSyncIoError",
      message: expect.stringContaining("query unavailable"),
    });
  });

  it("preserves typed failures when persisting the reconciled customer", async () => {
    const { t, userId } = await setup();
    const failure = await t.action((ctx) => {
      vi.spyOn(ctx, "runMutation").mockRejectedValueOnce(
        new Error("write unavailable")
      );
      return runConvexActionProgram(
        requireCustomer(ctx, userId).pipe(
          Effect.match({
            onFailure: (error) => ({ ...error, message: error.message }),
            onSuccess: () => null,
          })
        )
      );
    });
    expect(failure).toMatchObject({
      _tag: "CustomerSyncIoError",
      message: expect.stringContaining("write unavailable"),
    });
  });
});
