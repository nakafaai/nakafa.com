import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { readOwnedTryoutSectionContent } from "@repo/backend/convex/tryouts/runtime/access";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout-runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
});

describe("tryouts/runtime/access", () => {
  it("returns signed questions for the active section", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "content-active",
      })
    );

    const content = await t.query(async (ctx) => {
      const attempt = await ctx.db.get(seeded.attemptId);
      if (!attempt) {
        throw new Error("Expected an attempt fixture.");
      }
      return Effect.runPromise(
        readOwnedTryoutSectionContent(ctx, {
          attempt,
          appLocale: "id",
          sectionKey: TRYOUT_SECTION_KEY,
        })
      );
    });

    expect(content).toEqual({
      answers: [],
      kind: "signed",
      questions: [seeded.signedContent.question],
      runtime: "current",
    });
  });

  it("returns signed answers for a resolved terminal attempt", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "content-terminal",
      })
    );

    const content = await t.query(async (ctx) => {
      const attempt = await ctx.db.get(seeded.attemptId);
      if (!attempt) {
        throw new Error("Expected an attempt fixture.");
      }
      return Effect.runPromise(
        readOwnedTryoutSectionContent(ctx, {
          attempt,
          appLocale: "id",
          sectionKey: TRYOUT_SECTION_KEY,
        })
      );
    });

    expect(content).toEqual({
      answers: [seeded.signedContent.answer],
      kind: "signed",
      questions: [seeded.signedContent.question],
      runtime: "current",
    });
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

    await expect(
      t.query(async (ctx) => {
        const attempt = await ctx.db.get(seeded.attemptId);
        if (!attempt) {
          throw new Error("Expected an attempt fixture.");
        }
        return Effect.runPromise(
          readOwnedTryoutSectionContent(ctx, {
            attempt,
            appLocale: "id",
            sectionKey: TRYOUT_SECTION_KEY,
          })
        );
      })
    ).rejects.toThrow("Unable to read try-out content access.");
  });
});
