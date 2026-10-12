import { Ref } from "@confect/core";
import { assert, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { Option, Schema } from "effect";

const transport = vi.hoisted(() => ({
  live: vi.fn(() => true),
  read: vi.fn(() => false),
}));

// The session read answers what a test sets, and a session is live unless a
// test says otherwise. `components/betterAuth/session.test.ts` proves the real
// read, and `auth/session.test.ts` proves it through real functions.
vi.mock("@repo/backend/components/betterAuth/session", async () => {
  const { queryGeneric } = await import("convex/server");
  const { v } = await import("convex/values");
  return {
    live: queryGeneric({
      args: { now: v.number(), sessionId: v.string(), userId: v.string() },
      returns: v.boolean(),
      handler: () => transport.live(),
    }),
  };
});

// The transport returns malformed data while the real action, middleware and
// Confect query decoder remain in the execution path.
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

it.each([
  [
    "mutation",
    Ref.getFunctionReference(refs.public.users.mutations.updateUserName),
    refs.public.users.mutations.updateUserName,
    { name: "Verified user" },
  ],
  [
    "action",
    Ref.getFunctionReference(
      refs.public.customers.actions.sessions.generateCustomerPortalUrl
    ),
    refs.public.customers.actions.sessions.generateCustomerPortalUrl,
    {},
  ],
] as const)(
  "fails a %s closed with a typed, sanitized error when the session read fails",
  async (kind, reference, ref, args) => {
    transport.live.mockImplementationOnce(() => {
      throw new Error("private session details");
    });
    const now = Date.UTC(2026, 6, 28, 11);
    vi.setSystemTime(now);
    const test = createConvexTestWithBetterAuth();
    const identity = await test.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: `failed-read-${kind}` })
    );
    const signedIn = test.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const failure = await (kind === "mutation"
      ? signedIn.mutation(reference, args)
      : signedIn.action(reference, args)
    ).catch((error: unknown) => error);
    assert(Ref.isConvexError(failure));
    const decoded = Ref.decodeErrorOption(ref, failure.data);
    assert(Option.isSome(decoded));
    assert(decoded.value._tag === "AuthReadError");
    expect(Schema.encodeSync(AuthFailure)(decoded.value)).toEqual({
      _tag: "AuthReadError",
      code: "AUTH_READ_FAILED",
      message: "Unable to read authentication state.",
    });
    expect(failure.data).not.toHaveProperty("cause");
  }
);

it("asks Better Auth nothing for a write without a token", async () => {
  const test = createConvexTestWithBetterAuth();
  await expect(
    test.mutation(
      Ref.getFunctionReference(refs.public.users.mutations.updateUserName),
      { name: "Nobody" }
    )
  ).rejects.toMatchObject({ data: { _tag: "SessionRequired" } });
  expect(transport.live).not.toHaveBeenCalled();
});
