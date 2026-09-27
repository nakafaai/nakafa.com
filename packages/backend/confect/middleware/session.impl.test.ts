import { Ref } from "@confect/core";
import { expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";

const transport = vi.hoisted(() => ({ read: vi.fn(() => false) }));

// The transport returns malformed data while the real action, middleware,
// Better Auth component and Confect query decoder remain in the execution path.
vi.mock("@repo/backend/convex/users/queries", async () => {
  const { queryGeneric } = await import("convex/server");
  const { v } = await import("convex/values");
  return {
    getUserByAuthId: queryGeneric({
      args: { authId: v.string() },
      returns: v.boolean(),
      handler: () => transport.read(),
    }),
  };
});

it.each(["malformed", "unavailable"])(
  "redacts %s app identity before an authenticated action",
  async (failure) => {
    if (failure === "unavailable") {
      transport.read.mockImplementationOnce(() => {
        throw new Error("private app identity failure");
      });
    }
    const now = Date.UTC(2026, 6, 28, 11);
    vi.setSystemTime(now);
    const test = createConvexTestWithBetterAuth();
    const identity = await test.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now })
    );
    await expect(
      test
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .action(
          Ref.getFunctionReference(
            refs.public.customers.actions.sessions.generateCustomerPortalUrl
          ),
          {}
        )
    ).rejects.toMatchObject({
      data: {
        _tag: "AuthReadError",
        code: "AUTH_READ_FAILED",
        message: "Unable to read authentication state.",
      },
    });
  }
);
