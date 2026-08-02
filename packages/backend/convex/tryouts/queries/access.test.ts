import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { TryoutSectionContentAccess } from "@repo/backend/convex/tryouts/runtime/content";
import type { TryoutStatus } from "@repo/backend/convex/tryouts/status";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout-runtime";
import {
  insertTryoutSet,
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import type { FunctionArgs } from "convex/server";
import { describe, expect, it } from "vitest";

const contentArgs: FunctionArgs<
  typeof api.tryouts.queries.access.getSectionContent
> = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id",
  sectionKey: TRYOUT_SECTION_KEY,
  setKey: "set-1",
  trackKey: "2027",
};

const startAccessArgs: FunctionArgs<
  typeof api.tryouts.queries.access.getStartAccess
> = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id",
  now: TRYOUT_TEST_NOW,
  setKey: "set-1",
  trackKey: "2027",
};
const noContent: Extract<TryoutSectionContentAccess, { kind: "none" }> = {
  kind: "none",
};
const accessScenarios: readonly [
  TryoutStatus,
  TryoutStatus,
  TryoutSectionContentAccess,
][] = [
  [
    "in-progress",
    "in-progress",
    { answers: false, kind: "filesystem", questions: true },
  ],
  ["in-progress", "completed", noContent],
  ["completed", "in-progress", noContent],
  [
    "completed",
    "completed",
    { answers: true, kind: "filesystem", questions: true },
  ],
  [
    "expired",
    "expired",
    { answers: true, kind: "filesystem", questions: true },
  ],
];

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
    ).toEqual(noContent);
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
    ).toEqual(noContent);
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
    ).toEqual(noContent);
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
    ).toEqual(noContent);
  });

  it.each(accessScenarios)(
    "authorizes attempt=%s section=%s",
    async (attemptStatus, sectionStatus, expected) => {
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
    }
  );

  it("returns signed selectors without the pre-Aksara set row", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        signed: true,
        suffix: "content-signed-active",
      });
      await ctx.db.delete(fixture.tryoutSetId);
      return fixture;
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).resolves.toEqual({
      answers: [],
      kind: "signed",
      questions: [seeded.signedContent?.question],
    });
  });

  it("prefers a newer filesystem attempt after ownership rolls back", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const signed = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        signed: true,
        suffix: "content-signed-before-rollback",
      });
      const local = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "content-local-after-rollback",
      });
      await ctx.db.patch(local.attemptId, {
        attemptNumber: 2,
        lastActivityAt: TRYOUT_TEST_NOW + 1,
        startedAt: TRYOUT_TEST_NOW + 1,
        tryoutSetId: signed.tryoutSetId,
        userId: signed.identity.userId,
      });
      await ctx.db.delete(local.tryoutSetId);
      return signed.identity;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).resolves.toEqual({
      answers: false,
      kind: "filesystem",
      questions: true,
    });
  });

  it("returns entitled answer selectors only after terminal review", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        signed: true,
        suffix: "content-signed-review",
      })
    );
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).resolves.toEqual({
      answers: [seeded.signedContent?.answer],
      kind: "signed",
      questions: [seeded.signedContent?.question],
    });
  });

  it("fails closed when signed attempt locale identity drifts", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        signed: true,
        suffix: "content-signed-locale",
      });
      await ctx.db.patch(fixture.attemptId, { locale: "en" });
      return fixture;
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).rejects.toThrow(
      "Signed try-out attempt lost its locale or snapshot identity."
    );
  });

  it("fails closed when one signed placement is missing", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        signed: true,
        suffix: "content-signed-placement",
      });
      if (!fixture.placementId) {
        throw new Error("Expected a signed placement fixture.");
      }
      await ctx.db.delete(fixture.placementId);
      return fixture;
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).rejects.toThrow(
      "Signed try-out section lost one or more frozen placements."
    );
  });

  it("fails closed when one signed question selector is incomplete", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        signed: true,
        suffix: "content-signed-question",
      });
      if (!fixture.placementId) {
        throw new Error("Expected a signed placement fixture.");
      }
      await ctx.db.patch(fixture.placementId, {
        questionArtifactHash: undefined,
      });
      return fixture;
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).rejects.toThrow("Signed try-out question selector is incomplete.");
  });

  it("fails closed when one signed answer selector is incomplete", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        signed: true,
        suffix: "content-signed-answer",
      });
      if (!fixture.placementId) {
        throw new Error("Expected a signed placement fixture.");
      }
      await ctx.db.patch(fixture.placementId, {
        answerArtifactHash: undefined,
      });
      return fixture;
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).rejects.toThrow("Signed try-out answer selector is incomplete.");
  });

  it("maps duplicate section state into a typed read failure", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "content-duplicate-section",
      });
      const section = await ctx.db.get(fixture.sectionAttemptId);
      if (!section) {
        throw new Error("Expected a section attempt fixture.");
      }
      await ctx.db.insert("tryoutSectionAttempts", {
        answeredCount: section.answeredCount,
        completedAt: section.completedAt,
        correctAnswers: section.correctAnswers,
        endReason: section.endReason,
        expiresAt: section.expiresAt,
        lastActivityAt: section.lastActivityAt,
        score: section.score,
        sectionIdentity: section.sectionIdentity,
        sectionKey: section.sectionKey,
        sectionOrder: section.sectionOrder,
        startedAt: section.startedAt,
        status: section.status,
        totalQuestions: section.totalQuestions,
        tryoutAttemptId: section.tryoutAttemptId,
        tryoutSectionId: section.tryoutSectionId,
      });
      return fixture;
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).rejects.toThrow("Unable to read try-out content access.");
  });
});
