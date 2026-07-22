import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout-runtime";
import {
  insertTryoutSet,
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { describe, expect, it } from "vitest";

const contentArgs = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id" as const,
  sectionKey: TRYOUT_SECTION_KEY,
  setKey: "set-1",
  trackKey: "2027",
};

const startAccessArgs = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id" as const,
  now: TRYOUT_TEST_NOW,
  setKey: "set-1",
  trackKey: "2027",
};

describe("tryouts/queries/access", () => {
  it("shows one free attempt to anonymous and unclaimed accounts", async () => {
    const t = createConvexTestWithBetterAuth();

    expect(
      await t.query(api.tryouts.queries.access.getStartAccess, startAccessArgs)
    ).toEqual({ kind: "free-attempt" });

    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "start-access-free",
      })
    );
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getStartAccess,
        startAccessArgs
      )
    ).toEqual({ kind: "free-attempt" });
  });

  it("requires an upgrade after the account-level free claim", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "start-access-claimed",
      });
      await ctx.db.insert("tryoutFreeAttemptClaims", {
        claimedAt: TRYOUT_TEST_NOW,
        countryKey: "indonesia",
        examKey: "snbt",
        setKey: "set-1",
        trackKey: "2027",
        userId: seeded.userId,
      });
      return seeded;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getStartAccess,
        startAccessArgs
      )
    ).toEqual({ kind: "upgrade-required" });
  });

  it("prefers live included access over a consumed free claim", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "start-access-included",
      });
      await ctx.db.insert("tryoutFreeAttemptClaims", {
        claimedAt: TRYOUT_TEST_NOW,
        countryKey: "indonesia",
        examKey: "snbt",
        setKey: "set-1",
        trackKey: "2027",
        userId: seeded.userId,
      });
      await ctx.db.insert("tryoutEntitlements", {
        countryKey: "indonesia",
        endsAt: TRYOUT_TEST_NOW + 86_400_000,
        examKey: "snbt",
        sourceKind: "access-pass",
        startsAt: TRYOUT_TEST_NOW,
        userId: seeded.userId,
      });
      return seeded;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getStartAccess,
        startAccessArgs
      )
    ).toEqual({ kind: "included" });
  });

  it("rejects anonymous content access", async () => {
    const t = createConvexTestWithBetterAuth();

    expect(
      await t.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).toEqual({ answers: false, questions: false });
  });

  it("rejects access when the active set does not exist", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "content-missing-set",
      })
    );
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getSectionContent,
        contentArgs
      )
    ).toEqual({ answers: false, questions: false });
  });

  it("rejects access when the user has no attempt", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "content-missing-attempt",
      });
      await insertTryoutSet(ctx);

      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getSectionContent,
        contentArgs
      )
    ).toEqual({ answers: false, questions: false });
  });

  it("rejects access when the terminal attempt has no section", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "content-missing-section",
      });
      await ctx.db.delete(fixture.sectionAttemptId);

      return fixture;
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getSectionContent,
        contentArgs
      )
    ).toEqual({ answers: false, questions: false });
  });

  it.each([
    ["in-progress", "in-progress", { answers: false, questions: true }],
    ["in-progress", "completed", { answers: false, questions: false }],
    ["completed", "in-progress", { answers: false, questions: false }],
    ["completed", "completed", { answers: true, questions: true }],
    ["expired", "expired", { answers: true, questions: true }],
  ] as const)("authorizes attempt=%s section=%s", async (attemptStatus, sectionStatus, expected) => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus,
        sectionStatus,
        suffix: `content-${attemptStatus}-${sectionStatus}`,
      })
    );
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getSectionContent,
        contentArgs
      )
    ).toEqual(expected);
  });
});
