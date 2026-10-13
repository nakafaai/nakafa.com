import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";

const NOW = Date.UTC(2026, 9, 13, 8);
const HOUR = 60 * 60 * 1000;

/** Two signed-in users, each with one session that lasts an hour. */
async function seedTwoUsers() {
  const test = createConvexTestWithBetterAuth();
  const [one, other] = await test.mutation(async (ctx) => [
    await seedAuthenticatedUser(ctx, {
      now: NOW,
      sessionDurationMs: HOUR,
      suffix: "one",
    }),
    await seedAuthenticatedUser(ctx, {
      now: NOW,
      sessionDurationMs: HOUR,
      suffix: "other",
    }),
  ]);
  const live = (args: { now: number; sessionId: string; userId: string }) =>
    test.query((ctx) => ctx.runQuery(components.betterAuth.session.live, args));
  const remove = (model: "session" | "user", id: string) =>
    test.mutation((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model, where: [{ field: "_id", operator: "eq", value: id }] },
      })
    );
  return { live, one, other, remove };
}

describe("a live Better Auth session", () => {
  it("is live until the moment it expires", async () => {
    const { live, one } = await seedTwoUsers();
    const session = { sessionId: one.sessionId, userId: one.authUserId };
    expect(await live({ ...session, now: NOW })).toBe(true);
    expect(await live({ ...session, now: NOW + HOUR - 1 })).toBe(true);
    expect(await live({ ...session, now: NOW + HOUR })).toBe(false);
  });

  it("is not live at a time that is not a number", async () => {
    const { live, one } = await seedTwoUsers();
    expect(
      await live({
        now: Number.NaN,
        sessionId: one.sessionId,
        userId: one.authUserId,
      })
    ).toBe(false);
  });

  it("is not live for a user it does not belong to", async () => {
    const { live, one, other } = await seedTwoUsers();
    expect(
      await live({
        now: NOW,
        sessionId: one.sessionId,
        userId: other.authUserId,
      })
    ).toBe(false);
  });

  it("is not live for an id that names no session or no user", async () => {
    const { live, one } = await seedTwoUsers();
    expect(
      await live({ now: NOW, sessionId: "no-session", userId: one.authUserId })
    ).toBe(false);
    expect(
      await live({ now: NOW, sessionId: one.sessionId, userId: "no-user" })
    ).toBe(false);
    // An id of another table is not a session id.
    expect(
      await live({
        now: NOW,
        sessionId: one.authUserId,
        userId: one.authUserId,
      })
    ).toBe(false);
  });

  it("is not live once the session or its user is deleted", async () => {
    const { live, one, other, remove } = await seedTwoUsers();
    await remove("session", one.sessionId);
    expect(
      await live({
        now: NOW,
        sessionId: one.sessionId,
        userId: one.authUserId,
      })
    ).toBe(false);
    await remove("user", other.authUserId);
    expect(
      await live({
        now: NOW,
        sessionId: other.sessionId,
        userId: other.authUserId,
      })
    ).toBe(false);
  });
});
