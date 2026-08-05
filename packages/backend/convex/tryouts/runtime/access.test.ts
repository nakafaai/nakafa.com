import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { TryoutSectionContentAccess } from "@repo/backend/convex/tryouts/runtime/content";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout-runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import type { FunctionArgs } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
});

describe("tryouts/runtime/access", () => {
  it("rejects anonymous content access", async () => {
    const t = createConvexTestWithBetterAuth();

    await expect(
      t.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).resolves.toEqual(noContent);
  });

  it("returns signed questions for the active section", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "content-active",
      })
    );
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).resolves.toEqual({
      answers: [],
      kind: "signed",
      questions: [seeded.signedContent.question],
    });
  });

  it("requires an exact capability to review terminal content", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "content-terminal",
      })
    );
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).resolves.toEqual(noContent);
    await expect(
      authed.query(api.tryouts.queries.access.getSectionContent, {
        ...contentArgs,
        attemptId: seeded.attemptId,
      })
    ).resolves.toEqual({
      answers: [seeded.signedContent.answer],
      kind: "signed",
      questions: [seeded.signedContent.question],
    });
  });

  it("hides an exact attempt owned by another user", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const owner = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "content-owner",
      });
      const reader = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "content-reader",
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
