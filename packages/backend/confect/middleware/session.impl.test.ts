import { Ref } from "@confect/core";
import { expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";

const transport = vi.hoisted(() => ({
  read: vi.fn((): unknown => ({ appUser: null, userId: null })),
}));

// An action has no database, so it reads its caller through this query. The
// query answers what a test sets, while the real action, middleware and Confect
// decoder stay in the path; `auth/caller.test.ts` proves the real read.
vi.mock("@repo/backend/convex/auth/caller", async () => {
  const { queryGeneric } = await import("convex/server");
  const { v } = await import("convex/values");
  return {
    read: queryGeneric({
      args: {},
      returns: v.any(),
      handler: () => transport.read(),
    }),
  };
});

it.each(["malformed", "unavailable"])(
  "refuses an action with a typed, sanitized error when its %s caller read fails",
  async (failure) => {
    transport.read.mockImplementationOnce(() => {
      if (failure === "unavailable") {
        throw new Error("private app identity failure");
      }
      return { appUser: "not a row", userId: 42 };
    });
    const now = Date.UTC(2026, 6, 28, 11);
    vi.setSystemTime(now);
    const test = createConvexTestWithAuth();
    const identity = await test.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now })
    );
    const failed = await test
      .withIdentity({ subject: identity.sessionId })
      .action(
        Ref.getFunctionReference(
          refs.public.billing.sessions.generateCustomerPortalUrl
        ),
        {}
      )
      .catch((error: unknown) => error);
    expect(failed).toMatchObject({
      data: {
        _tag: "AuthReadError",
        code: "AUTH_READ_FAILED",
        message: "Unable to read authentication state.",
      },
    });
    expect(JSON.stringify(failed)).not.toContain("private app identity");
  }
);

it("gives an action without a caller no session, so it refuses before its handler runs", async () => {
  const test = createConvexTestWithAuth();
  await expect(
    test.action(
      Ref.getFunctionReference(
        refs.public.billing.sessions.generateCustomerPortalUrl
      ),
      {}
    )
  ).rejects.toMatchObject({ data: { _tag: "SessionRequired" } });
});
