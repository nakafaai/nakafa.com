import { Ref } from "@confect/core";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { AuthFailure, SessionRequired } from "@repo/backend/confect/auth/spec";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { Option, Schema } from "effect";

const NOW = Date.UTC(2026, 6, 28, 11, 0, 0);
const currentUser = Ref.getFunctionReference(
  refs.public.auth.queries.getCurrentUser
);
const memberships = Ref.getFunctionReference(
  refs.public.tenancy.memberships.list
);
const firstPage = { paginationOpts: { cursor: null, numItems: 1 } };
const updateName = Ref.getFunctionReference(
  refs.public.users.mutations.updateUserName
);
const admitOnboarding = Ref.getFunctionReference(
  refs.public.onboarding.mutations.admit
);
const customerPortal = Ref.getFunctionReference(
  refs.public.billing.sessions.generateCustomerPortalUrl
);

beforeEach(() => vi.setSystemTime(NOW));
afterEach(() => vi.restoreAllMocks());

describe("token-verified reads and session-validated writes", () => {
  it("resolves the same active account through registered reads and writes", async () => {
    const t = createConvexTestWithAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "active-auth" })
    );
    const authenticated = t.withIdentity({ subject: identity.sessionId });
    expect(await authenticated.query(currentUser, {})).toMatchObject({
      appUser: { _id: identity.userId },
    });
    expect(await authenticated.query(memberships, firstPage)).toMatchObject({
      isDone: true,
      page: [],
    });
    await authenticated.mutation(updateName, { name: "Verified user" });
    expect(await authenticated.mutation(admitOnboarding, {})).toMatchObject({
      isAuthenticated: true,
    });
  });

  it("refuses anonymous callers on every function type", async () => {
    const t = createConvexTestWithAuth();
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
    await expect(t.query(memberships, firstPage)).rejects.toMatchObject({
      data: { _tag: "SessionRequired" },
    });
    await expect(t.action(customerPortal, {})).rejects.toMatchObject({
      data: { _tag: "SessionRequired" },
    });
  });

  it("stops a signed-out session at once on every function type", async () => {
    const t = createConvexTestWithAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "signed-out" })
    );
    const signedOut = t.withIdentity({ subject: identity.sessionId });
    expect(await signedOut.query(currentUser, {})).toMatchObject({
      appUser: { _id: identity.userId },
    });
    // The token still verifies, but its session row is gone.
    await t.mutation((ctx) =>
      ctx.runMutation(components.auth.public.revokeSessions, {
        sessionIds: [identity.sessionId],
      })
    );
    expect(await signedOut.query(currentUser, {})).toBeNull();
    await expect(
      signedOut.query(memberships, firstPage)
    ).rejects.toMatchObject({ data: { _tag: "SessionRequired" } });
    expect(await signedOut.mutation(admitOnboarding, {})).toMatchObject({
      isAuthenticated: false,
    });
    await expect(
      signedOut.mutation(updateName, { name: "Verified user" })
    ).rejects.toMatchObject({ data: { _tag: "SessionRequired" } });
    await expect(signedOut.action(customerPortal, {})).rejects.toMatchObject({
      data: { _tag: "SessionRequired" },
    });
  });

  it("resolves a token whose subject is no session to nobody", async () => {
    const t = createConvexTestWithAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "no-session" })
    );
    // The subject names the user, not a session, so no session row answers it.
    const unnamed = t.withIdentity({ subject: identity.userId });
    expect(await unnamed.query(currentUser, {})).toBeNull();
    await expect(
      unnamed.mutation(updateName, { name: "Verified user" })
    ).rejects.toMatchObject({ data: { _tag: "SessionRequired" } });
    expect(await unnamed.mutation(admitOnboarding, {})).toMatchObject({
      isAuthenticated: false,
    });
  });

  it("rejects removed accounts instead of allowing them to write anonymously", async () => {
    const t = createConvexTestWithAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "removed-auth" })
    );
    const authenticated = t.withIdentity({ subject: identity.sessionId });
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
    await expect(
      authenticated.query(memberships, firstPage)
    ).rejects.toMatchObject({
      data: { _tag: "AccountUnavailable", code: "UNAUTHORIZED" },
    });
    await expect(
      authenticated.action(customerPortal, {})
    ).rejects.toMatchObject({
      data: { _tag: "AccountUnavailable", code: "UNAUTHORIZED" },
    });
  });
});
