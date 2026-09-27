import { Ref } from "@confect/core";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { authReader } from "@repo/backend/confect/auth/reader";
import { AuthFailure, SessionRequired } from "@repo/backend/confect/auth/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { Option, Schema } from "effect";

const NOW = Date.UTC(2026, 6, 28, 11, 0, 0);
const currentUser = Ref.getFunctionReference(
  refs.public.auth.queries.getCurrentUser
);
const schoolLanding = Ref.getFunctionReference(
  refs.public.schools.queries.getMySchoolLandingState
);
const updateName = Ref.getFunctionReference(
  refs.public.users.mutations.updateUserName
);
const admitOnboarding = Ref.getFunctionReference(
  refs.public.onboarding.mutations.admit
);
const customerPortal = Ref.getFunctionReference(
  refs.public.customers.actions.sessions.generateCustomerPortalUrl
);

beforeEach(() => vi.setSystemTime(NOW));
afterEach(() => vi.restoreAllMocks());

describe("session-validated app identity", () => {
  it("resolves the same active account through registered reads and writes", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "active-auth" })
    );
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    expect(await authenticated.query(currentUser, {})).toMatchObject({
      appUser: { _id: identity.userId },
    });
    expect(await authenticated.query(schoolLanding, {})).toEqual({
      kind: "none",
    });
    await authenticated.mutation(updateName, { name: "Verified user" });
    expect(await authenticated.mutation(admitOnboarding, {})).toMatchObject({
      isAuthenticated: true,
    });
  });

  it("does not trust an identity whose Better Auth session expired", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "expired-auth",
        sessionDurationMs: 0,
      })
    );
    const expired = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    for (const caller of [t, expired]) {
      expect(await caller.query(currentUser, {})).toBeNull();
      expect(await caller.mutation(admitOnboarding, {})).toMatchObject({
        isAuthenticated: false,
      });
      const failure = await caller
        .mutation(updateName, { name: "Verified user" })
        .catch((error: unknown) => error);
      assert(Ref.isConvexError(failure));
      const decoded = Ref.decodeErrorOption(
        refs.public.users.mutations.updateUserName,
        failure.data
      );
      assert(Option.isSome(decoded));
      expect(decoded.value).toBeInstanceOf(SessionRequired);
      expect(Schema.encodeSync(AuthFailure)(decoded.value)).toEqual({
        _tag: "SessionRequired",
        code: "UNAUTHENTICATED",
        message: "Unauthenticated",
      });
      await expect(caller.query(schoolLanding, {})).rejects.toMatchObject({
        data: { _tag: "SessionRequired" },
      });
      await expect(caller.action(customerPortal, {})).rejects.toMatchObject({
        data: { _tag: "SessionRequired" },
      });
    }
  });

  it("rejects removed accounts instead of allowing them to write anonymously", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "removed-auth" })
    );
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    await t.mutation((ctx) =>
      ctx.db.patch("users", identity.userId, { deletedAt: NOW })
    );
    expect(await authenticated.query(currentUser, {})).toBeNull();
    await expect(
      authenticated.mutation(updateName, { name: "Verified user" })
    ).rejects.toMatchObject({
      data: { _tag: "AccountUnavailable", code: "UNAUTHORIZED" },
    });
    await expect(
      authenticated.mutation(admitOnboarding, {})
    ).rejects.toMatchObject({
      data: { _tag: "AccountUnavailable", code: "UNAUTHORIZED" },
    });
    await t.mutation((ctx) => ctx.db.delete("users", identity.userId));
    expect(await authenticated.query(currentUser, {})).toBeNull();
    await expect(
      authenticated.mutation(admitOnboarding, {})
    ).rejects.toMatchObject({
      data: { _tag: "AccountUnavailable", code: "UNAUTHORIZED" },
    });
    await expect(authenticated.query(schoolLanding, {})).rejects.toMatchObject({
      data: { _tag: "AccountUnavailable", code: "UNAUTHORIZED" },
    });
    await expect(
      authenticated.action(customerPortal, {})
    ).rejects.toMatchObject({
      data: { _tag: "AccountUnavailable", code: "UNAUTHORIZED" },
    });
  });

  it("fails closed with a typed, sanitized error when the session component is unavailable", async () => {
    vi.spyOn(authReader, "safeGetAuthUser").mockRejectedValueOnce(
      new Error("private adapter details")
    );
    const t = createConvexTestWithBetterAuth();
    const failure = await t
      .query(schoolLanding, {})
      .catch((error: unknown) => error);
    assert(Ref.isConvexError(failure));
    const decoded = Ref.decodeErrorOption(
      refs.public.schools.queries.getMySchoolLandingState,
      failure.data
    );
    assert(Option.isSome(decoded));
    assert(decoded.value._tag === "AuthReadError");
    expect(Schema.encodeSync(AuthFailure)(decoded.value)).toEqual({
      _tag: "AuthReadError",
      code: "AUTH_READ_FAILED",
      message: "Unable to read authentication state.",
    });
    expect(failure.data).not.toHaveProperty("cause");
  });

  it("keeps prepared users readable while rejecting authenticated operations", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "prepared-auth" })
    );
    await t.mutation((ctx) =>
      ctx.db.patch("users", identity.userId, { deletionPreparedAt: NOW })
    );
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    expect(await authenticated.query(currentUser, {})).toMatchObject({
      appUser: { _id: identity.userId },
    });
    await expect(
      authenticated.mutation(updateName, { name: "Verified user" })
    ).rejects.toMatchObject({
      data: { _tag: "AccountUnavailable", code: "UNAUTHORIZED" },
    });
    await expect(
      authenticated.mutation(admitOnboarding, {})
    ).rejects.toMatchObject({
      data: { _tag: "AccountUnavailable", code: "UNAUTHORIZED" },
    });
    await expect(authenticated.query(schoolLanding, {})).rejects.toMatchObject({
      data: { _tag: "AccountUnavailable", code: "UNAUTHORIZED" },
    });
    await expect(
      authenticated.action(customerPortal, {})
    ).rejects.toMatchObject({
      data: { _tag: "AccountUnavailable", code: "UNAUTHORIZED" },
    });
  });
});
