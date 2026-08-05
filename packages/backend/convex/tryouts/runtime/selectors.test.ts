import { api } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { loadTryoutSignedContent } from "@repo/backend/convex/tryouts/runtime/selectors";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout-runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import type { FunctionArgs } from "convex/server";
import { Cause, Effect, Exit, Option } from "effect";
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

beforeEach(() => {
  vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
});

describe("tryouts/runtime/selectors", () => {
  it("returns signed selectors without the pre-Aksara set row", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
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

  it("returns entitled answer selectors only after terminal review", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "content-signed-review",
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
      })
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

  it("maps placement read failures into the typed selector error", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "content-selector-read-failure",
      })
    );

    const failure = await t.query(async (ctx) => {
      const attempt = await ctx.db.get(seeded.attemptId);
      if (!(attempt?.snapshotReleaseId && attempt.tryoutSnapshotId)) {
        throw new Error("Expected a signed attempt fixture.");
      }
      vi.spyOn(ctx.db, "query").mockImplementationOnce(() => {
        throw new Error("Injected selector read failure.");
      });

      const exit = await Effect.runPromiseExit(
        loadTryoutSignedContent({
          access: { answers: false, questions: true },
          attempt,
          ctx,
          locale: "id",
          sectionKey: TRYOUT_SECTION_KEY,
          snapshotId: attempt.tryoutSnapshotId,
          snapshotReleaseId: attempt.snapshotReleaseId,
          totalQuestions: 1,
        })
      );
      if (Exit.isSuccess(exit)) {
        throw new Error("Expected selector resolution to fail.");
      }

      const error = Cause.failureOption(exit.cause);
      if (Option.isNone(error)) {
        throw new Error("Expected a typed selector failure.");
      }
      return {
        code: error.value.code,
        message: error.value.message,
        tag: error.value._tag,
      };
    });

    expect(failure).toMatchObject({
      code: "TRYOUT_SELECTOR_INTEGRITY",
      message: "Unable to read signed try-out selectors.",
      tag: "TryoutSelectorReadError",
    });
  });
});
