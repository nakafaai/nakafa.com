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

describe("token-verified reads and session-validated writes", () => {
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

  it("refuses anonymous callers on every function type", async () => {
    const t = createConvexTestWithBetterAuth();
    expect(await t.query(currentUser, {})).toBeNull();
    expect(await t.mutation(admitOnboarding, {})).toMatchObject({
      isAuthenticated: false,
    });
    const failure = await t
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
    await expect(t.query(schoolLanding, {})).rejects.toMatchObject({
      data: { _tag: "SessionRequired" },
    });
    await expect(t.action(customerPortal, {})).rejects.toMatchObject({
      data: { _tag: "SessionRequired" },
    });
  });

  it("reads from the verified token alone and confirms the live session before writes", async () => {
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
    // Revocation follows the token's short lifetime for reads: an expired
    // session still reads, so a read asks Better Auth nothing.
    expect(await expired.query(currentUser, {})).toMatchObject({
      appUser: { _id: identity.userId },
      authUser: { _id: identity.authUserId, name: "User expired-auth" },
    });
    expect(await expired.query(schoolLanding, {})).toEqual({ kind: "none" });
    expect(await expired.mutation(admitOnboarding, {})).toMatchObject({
      isAuthenticated: false,
    });
    await expect(
      expired.mutation(updateName, { name: "Verified user" })
    ).rejects.toMatchObject({ data: { _tag: "SessionRequired" } });
    await expect(expired.action(customerPortal, {})).rejects.toMatchObject({
      data: { _tag: "SessionRequired" },
    });
  });

  it("refuses a write whose token names another user's session", async () => {
    const t = createConvexTestWithBetterAuth();
    const [owner, other] = await t.mutation(async (ctx) => [
      await seedAuthenticatedUser(ctx, { now: NOW, suffix: "session-owner" }),
      await seedAuthenticatedUser(ctx, { now: NOW, suffix: "session-other" }),
    ]);
    const mismatched = t.withIdentity({
      sessionId: owner.sessionId,
      subject: other.authUserId,
    });
    await expect(
      mismatched.mutation(updateName, { name: "Verified user" })
    ).rejects.toMatchObject({ data: { _tag: "SessionRequired" } });
    await expect(mismatched.action(customerPortal, {})).rejects.toMatchObject({
      data: { _tag: "SessionRequired" },
    });
  });

  it("fails a write whose token does not name its session, also where a caller without a session may write", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "no-session" })
    );
    const unnamed = t.withIdentity({ subject: identity.authUserId });
    const failed = {
      data: {
        _tag: "AuthReadError",
        code: "AUTH_READ_FAILED",
        message: "Unable to read authentication state.",
      },
    };
    await expect(
      unnamed.mutation(updateName, { name: "Verified user" })
    ).rejects.toMatchObject(failed);
    // Onboarding admits a caller without a session, so an absent session
    // would let this write through as anonymous.
    await expect(unnamed.mutation(admitOnboarding, {})).rejects.toMatchObject(
      failed
    );
    await expect(unnamed.action(customerPortal, {})).rejects.toMatchObject(
      failed
    );
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
