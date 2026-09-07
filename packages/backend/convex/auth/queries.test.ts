import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";

describe("authenticated user query contracts", () => {
  it("returns the app and component identities only for an existing session", async () => {
    const t = createConvexTestWithBetterAuth();
    expect(await t.query(api.auth.queries.getCurrentUser)).toBeNull();
    const user = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: Date.now(), suffix: "query-user" })
    );
    const authed = t.withIdentity({
      sessionId: user.sessionId,
      subject: user.authUserId,
    });
    expect(await authed.query(api.auth.queries.getCurrentUser)).toMatchObject({
      appUser: { _id: user.userId, authId: user.authUserId },
      authUser: { _id: user.authUserId, name: "User query-user" },
    });
    await t.mutation((ctx) => ctx.db.delete("users", user.userId));
    expect(await authed.query(api.auth.queries.getCurrentUser)).toBeNull();
  });

  it("exposes only public profile fields and handles absent images and users", async () => {
    const t = createConvexTestWithBetterAuth();
    const user = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: Date.now(), suffix: "public-profile" })
    );
    const args = { userId: user.userId };
    expect(await t.query(api.auth.queries.getUserById, args)).toEqual({
      name: "User public-profile",
    });
    await t.mutation((ctx) =>
      ctx.db.patch("users", user.userId, {
        image: "https://example.com/user.png",
      })
    );
    expect(await t.query(api.auth.queries.getUserById, args)).toEqual({
      image: "https://example.com/user.png",
      name: "User public-profile",
    });
    await t.mutation((ctx) => ctx.db.delete("users", user.userId));
    expect(await t.query(api.auth.queries.getUserById, args)).toBeNull();
  });
});
