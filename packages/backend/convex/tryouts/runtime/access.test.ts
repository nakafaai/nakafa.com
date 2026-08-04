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

describe("tryouts/runtime/access", () => {
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

    const result = await authed.query(
      api.tryouts.queries.access.getSectionContent,
      contentArgs
    );
    expect(result).toEqual(noContent);
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

    const result = await authed.query(
      api.tryouts.queries.access.getSectionContent,
      contentArgs
    );
    expect(result).toEqual(noContent);
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

  it("serves the active frozen section after its published key changes", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        signed: true,
        suffix: "content-signed-frozen-entry",
      });
      if (!fixture.placementId) {
        throw new Error("Expected a signed placement fixture.");
      }
      await ctx.db.patch(fixture.attemptId, {
        sectionSnapshots: [
          {
            questionCount: 1,
            questionSourcePath: "question-bank/tryout/legacy-entry",
            sectionKey: "legacy-entry",
            sectionOrder: 1,
            sourceRevision: "2026",
            timeLimitSeconds: 1800,
          },
        ],
      });
      await ctx.db.patch(fixture.sectionAttemptId, {
        sectionKey: "legacy-entry",
      });
      await ctx.db.patch(fixture.placementId, {
        sectionKey: "legacy-entry",
      });
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

  it("prefers a newer filesystem attempt during signed migration", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const signed = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        signed: true,
        suffix: "content-signed-before-migration",
      });
      const local = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "content-local-during-migration",
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

  it("binds protected content to the route-selected attempt", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const signed = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        signed: true,
        suffix: "content-route-selected",
      });
      const newer = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "content-route-newer",
      });
      await ctx.db.patch(newer.attemptId, {
        attemptNumber: 2,
        lastActivityAt: TRYOUT_TEST_NOW + 1,
        startedAt: TRYOUT_TEST_NOW + 1,
        tryoutSetId: signed.tryoutSetId,
        userId: signed.identity.userId,
      });
      await ctx.db.delete(newer.tryoutSetId);
      return signed;
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, {
        ...contentArgs,
        attemptId: seeded.attemptId,
      })
    ).resolves.toEqual({
      answers: [],
      kind: "signed",
      questions: [seeded.signedContent?.question],
    });
  });

  it("hides an exact attempt owned by another user", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const owner = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        signed: true,
        suffix: "content-owned-attempt",
      });
      const reader = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "content-other-reader",
      });
      return { owner, reader };
    });
    const authed = t.withIdentity({
      sessionId: seeded.reader.sessionId,
      subject: seeded.reader.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, {
        ...contentArgs,
        attemptId: seeded.owner.attemptId,
      })
    ).resolves.toEqual(noContent);
  });

  it("fails closed when an exact attempt uses another route identity", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        signed: true,
        suffix: "content-route-mismatch",
      })
    );
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, {
        ...contentArgs,
        attemptId: seeded.attemptId,
        setKey: "another-set",
      })
    ).rejects.toThrow(
      "Try-out content request differs from its frozen attempt identity."
    );
  });

  it("fails closed when a signed attempt loses its release identity", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        signed: true,
        suffix: "content-missing-release",
      });
      await ctx.db.patch(fixture.attemptId, { snapshotReleaseId: undefined });
      return fixture;
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).rejects.toThrow(
      "Signed try-out attempt lost its frozen release identity."
    );
  });

  it("fails closed when active section rows exceed the frozen snapshot", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        signed: true,
        suffix: "content-section-overflow",
      });
      await ctx.db.patch(fixture.attemptId, { sectionSnapshots: [] });
      return fixture;
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, {
        ...contentArgs,
        sectionKey: "renamed-section",
      })
    ).rejects.toThrow(
      "Try-out section attempt count exceeds its frozen snapshot."
    );
  });

  it("returns no content when a renamed route has no active section", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "completed",
        signed: true,
        suffix: "content-renamed-completed-section",
      });
      await ctx.db.patch(fixture.attemptId, {
        sectionSnapshots: [
          {
            questionCount: 1,
            questionSourcePath: "question-bank/tryout/completed-section",
            sectionKey: TRYOUT_SECTION_KEY,
            sectionOrder: 1,
            sourceRevision: "2026",
            timeLimitSeconds: 1800,
          },
        ],
      });
      return fixture;
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, {
        ...contentArgs,
        sectionKey: "renamed-section",
      })
    ).resolves.toEqual(noContent);
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
