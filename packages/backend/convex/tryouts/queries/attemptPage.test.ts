import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  activateRenamedTryoutStartSource,
  activateReusedTryoutStartPath,
  activateRevisedTryoutStartEntry,
  TRYOUT_RENAMED_SET_PATH,
  TRYOUT_REUSED_SECTION,
  TRYOUT_REUSED_SET,
  TRYOUT_REVISED_SECTION,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout-start";
import { describe, expect, it, vi } from "vitest";

const setIdentity = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};
const setPublicPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const sectionPublicPath = `${setPublicPath}/${TRYOUT_START_SECTION}`;

describe("tryouts/queries/attemptPage", () => {
  it("redirects an active set and resolves a current terminal restart", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "set-attempt-page",
      });
      await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "internal-entry",
      });
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      { ...setIdentity, entrySectionKey: TRYOUT_START_SECTION }
    );

    const currentRequest = { kind: "current" as const, ...setIdentity };
    await expect(
      authed.query(api.tryouts.queries.attemptPage.getSet, {
        request: currentRequest,
      })
    ).resolves.toEqual({
      attemptId: started.attemptId,
      kind: "redirect",
      publicPath: setPublicPath,
    });

    const retainedRequest = {
      attemptId: started.attemptId,
      kind: "retained" as const,
      locale: "id" as const,
      publicPath: setPublicPath,
    };
    const active = await authed.query(api.tryouts.queries.attemptPage.getSet, {
      request: retainedRequest,
    });
    expect(active).toMatchObject({
      attemptId: started.attemptId,
      content: { answers: [], kind: "signed" },
      initialState: {
        attempt: { status: "in-progress" },
        runtime: { questions: expect.any(Array) },
      },
      kind: "retained",
      page: {
        entrySection: { sectionKey: TRYOUT_START_SECTION },
        set: { setKey: TRYOUT_START_SET },
      },
    });
    expect(active).not.toHaveProperty("setIdentity");

    const historicalAnswerTime = TRYOUT_START_NOW + 1000;
    await t.mutation(async (ctx) => {
      const placement = await ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
          query.eq("tryoutAttemptId", started.attemptId)
        )
        .unique();
      const section = await ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionKey", (query) =>
          query
            .eq("tryoutAttemptId", started.attemptId)
            .eq("sectionKey", TRYOUT_START_SECTION)
        )
        .unique();
      if (!(placement && section)) {
        throw new Error("Expected one historical response target.");
      }
      await ctx.db.insert("tryoutResponses", {
        answeredAt: historicalAnswerTime,
        isCorrect: false,
        placementId: placement._id,
        textAnswer: "historical answer",
        timeSpent: 1000,
        tryoutAttemptId: started.attemptId,
        tryoutSectionAttemptId: section._id,
        updatedAt: historicalAnswerTime,
      });
    });

    await authed.mutation(api.tryouts.mutations.sections.complete, {
      attemptId: started.attemptId,
      sectionKey: TRYOUT_START_SECTION,
    });
    await t.mutation(activateRevisedTryoutStartEntry);
    const terminal = await authed.query(
      api.tryouts.queries.attemptPage.getSet,
      { request: currentRequest }
    );
    expect(terminal).toMatchObject({
      attemptId: started.attemptId,
      content: {
        answers: expect.any(Array),
        kind: "signed",
        questions: expect.any(Array),
      },
      initialState: {
        attempt: {
          score: { publishedScore: 0 },
          status: "completed",
        },
        runtime: { section: { status: "completed" } },
      },
      kind: "current",
      page: { set: { publicPath: setPublicPath } },
      restartTarget: {
        entrySection: { sectionKey: TRYOUT_REVISED_SECTION },
        setPublicPath: TRYOUT_RENAMED_SET_PATH,
      },
    });
    expect(terminal).not.toHaveProperty("setIdentity");
    if (terminal?.kind !== "current") {
      throw new Error("Expected one current terminal set page.");
    }
    if (terminal.content.kind !== "signed") {
      throw new Error("Expected signed terminal set content.");
    }
    expect(terminal.content.answers).toHaveLength(1);
    expect(terminal.initialState.runtime?.questions.at(0)?.response).toEqual({
      answeredAt: historicalAnswerTime,
      updatedAt: historicalAnswerTime,
    });
  });

  it("rejects progress that disagrees with its latest attempt", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const owner = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "progress-owner",
      });
      const other = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "progress-other",
      });
      await seedTryoutStartSet(ctx, {
        userId: owner.userId,
        visibility: "internal-entry",
      });
      return { ...owner, otherUserId: other.userId };
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      { ...setIdentity, entrySectionKey: TRYOUT_START_SECTION }
    );
    const request = { kind: "current" as const, ...setIdentity };
    const expectMismatch = () =>
      expect(
        authed.query(api.tryouts.queries.attemptPage.getSet, { request })
      ).rejects.toThrow("TRYOUT_PROGRESS_ATTEMPT_MISMATCH");

    const progress = await t.mutation(async (ctx) => {
      const progress = await ctx.db.query("tryoutSetProgress").unique();
      if (!progress) {
        throw new Error("Expected one try-out progress row.");
      }
      return { id: progress._id, setIdentity: progress.setIdentity };
    });

    await t.mutation((ctx) =>
      ctx.db.patch(progress.id, { countryKey: "germany" })
    );
    await expectMismatch();
    await t.mutation((ctx) =>
      ctx.db.patch(progress.id, { countryKey: TRYOUT_START_COUNTRY })
    );

    await t.mutation((ctx) =>
      ctx.db.patch(started.attemptId, { countryKey: "germany" })
    );
    await expectMismatch();
    await t.mutation((ctx) =>
      ctx.db.patch(started.attemptId, {
        countryKey: TRYOUT_START_COUNTRY,
        userId: identity.otherUserId,
      })
    );
    await expectMismatch();
    await t.mutation((ctx) =>
      ctx.db.patch(started.attemptId, {
        setIdentity: "set:drift",
        userId: identity.userId,
      })
    );
    await expectMismatch();
    await t.mutation((ctx) =>
      ctx.db.patch(started.attemptId, {
        setIdentity: progress.setIdentity,
      })
    );

    await t.mutation((ctx) => ctx.db.patch(progress.id, { attemptNumber: 2 }));
    await expectMismatch();
    await t.mutation((ctx) =>
      ctx.db.patch(progress.id, { attemptNumber: 1, status: "completed" })
    );
    await expectMismatch();
    await t.mutation((ctx) =>
      ctx.db.patch(progress.id, { status: "in-progress", statusRank: 2 })
    );
    await expectMismatch();
  });

  it("keeps frozen review while resolving the current signed restart entry", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "set-restart-target",
      });
      await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "internal-entry",
      });
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      { ...setIdentity, entrySectionKey: TRYOUT_START_SECTION }
    );
    await authed.mutation(api.tryouts.mutations.sections.complete, {
      attemptId: started.attemptId,
      sectionKey: TRYOUT_START_SECTION,
    });
    const request = {
      attemptId: started.attemptId,
      kind: "retained" as const,
      locale: "id" as const,
      publicPath: setPublicPath,
    };

    await t.mutation(activateRevisedTryoutStartEntry);
    const revised = await authed.query(api.tryouts.queries.attemptPage.getSet, {
      request,
    });
    expect(revised).toMatchObject({
      kind: "retained",
      page: {
        entrySection: { sectionKey: TRYOUT_START_SECTION },
        set: { publicPath: setPublicPath },
      },
      restartTarget: {
        entrySection: {
          sectionKey: TRYOUT_REVISED_SECTION,
          visibility: "internal-entry",
        },
        setPublicPath: TRYOUT_RENAMED_SET_PATH,
      },
    });
    if (revised?.kind !== "retained") {
      throw new Error("Expected one retained set page.");
    }
    expect(revised.page.entrySection?.publicPath).toBeUndefined();
    expect(revised.restartTarget?.entrySection.publicPath).toBeUndefined();

    await t.mutation(activateReusedTryoutStartPath);
    await expect(
      authed.query(api.tryouts.queries.attemptPage.getSet, { request })
    ).resolves.toMatchObject({
      kind: "retained",
      page: {
        entrySection: { sectionKey: TRYOUT_START_SECTION },
        set: { publicPath: setPublicPath },
      },
      restartTarget: null,
    });
  });

  it("keeps exact section ownership after rename and rejects reused paths", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "section-attempt-page",
      });
      await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "visible",
      });
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      { ...setIdentity, destinationSectionKey: TRYOUT_START_SECTION }
    );
    await authed.mutation(api.tryouts.mutations.sections.start, {
      attemptId: started.attemptId,
      sectionKey: TRYOUT_START_SECTION,
    });

    const currentRequest = {
      kind: "current" as const,
      sectionKey: TRYOUT_START_SECTION,
      ...setIdentity,
    };
    await expect(
      authed.query(api.tryouts.queries.attemptPage.getSection, {
        request: currentRequest,
      })
    ).resolves.toEqual({
      attemptId: started.attemptId,
      kind: "redirect",
      publicPath: sectionPublicPath,
    });

    const retainedRequest = {
      attemptId: started.attemptId,
      kind: "retained" as const,
      locale: "id" as const,
      publicPath: sectionPublicPath,
    };
    await expect(
      authed.query(api.tryouts.queries.attemptPage.getSection, {
        request: retainedRequest,
      })
    ).resolves.toMatchObject({
      activeSectionPublicPath: sectionPublicPath,
      activeSetPublicPath: setPublicPath,
      content: { answers: [], kind: "signed" },
      initialState: {
        attempt: { attemptId: started.attemptId },
        runtime: { questions: expect.any(Array) },
      },
      kind: "retained",
      page: { section: { sectionKey: TRYOUT_START_SECTION } },
    });

    await t.mutation(activateRenamedTryoutStartSource);
    await expect(
      authed.query(api.tryouts.queries.attemptPage.getSection, {
        request: retainedRequest,
      })
    ).resolves.toMatchObject({
      activeSectionPublicPath: expect.stringContaining(TRYOUT_START_SECTION),
      activeSetPublicPath: TRYOUT_RENAMED_SET_PATH,
      kind: "retained",
    });

    await t.mutation(activateRevisedTryoutStartEntry);
    await expect(
      authed.query(api.tryouts.queries.attemptPage.getSection, {
        request: retainedRequest,
      })
    ).resolves.toMatchObject({
      activeSectionPublicPath: null,
      activeSetPublicPath: TRYOUT_RENAMED_SET_PATH,
      kind: "retained",
    });

    await t.mutation(activateReusedTryoutStartPath);
    await expect(
      authed.query(api.tryouts.queries.attemptPage.getSection, {
        request: {
          countryKey: TRYOUT_START_COUNTRY,
          examKey: TRYOUT_START_EXAM,
          kind: "current",
          locale: "id",
          sectionKey: TRYOUT_REUSED_SECTION,
          setKey: TRYOUT_REUSED_SET,
          trackKey: TRYOUT_START_TRACK,
        },
      })
    ).resolves.toBeNull();
    await expect(
      authed.query(api.tryouts.queries.attemptPage.getSection, {
        request: retainedRequest,
      })
    ).resolves.toMatchObject({
      activeSectionPublicPath: null,
      activeSetPublicPath: null,
      kind: "retained",
    });
    await expect(
      t.query(api.tryouts.queries.attemptPage.getSection, {
        request: retainedRequest,
      })
    ).resolves.toBeNull();
    await expect(
      authed.query(api.tryouts.queries.attemptPage.getSet, {
        request: {
          attemptId: "not-an-id",
          kind: "retained",
          locale: "id",
          publicPath: setPublicPath,
        },
      })
    ).resolves.toBeNull();

    const originalSnapshot = await t.mutation(async (ctx) => {
      const attempt = await ctx.db.get(started.attemptId);
      if (!attempt) {
        throw new Error("Expected one frozen attempt.");
      }
      const snapshot = attempt.sectionSnapshots.at(0);
      if (!snapshot) {
        throw new Error("Expected one frozen section snapshot.");
      }
      await ctx.db.patch(started.attemptId, {
        sectionSnapshots: attempt.sectionSnapshots.map((candidate) => ({
          ...candidate,
          sourceRevision: `${candidate.sourceRevision}-drift`,
        })),
      });
      return snapshot;
    });
    await expect(
      authed.query(api.tryouts.queries.attemptPage.getSection, {
        request: retainedRequest,
      })
    ).rejects.toThrow("TRYOUT_SECTION_SNAPSHOT_MISMATCH");

    await t.mutation(async (ctx) => {
      const attempt = await ctx.db.get(started.attemptId);
      if (!attempt) {
        throw new Error("Expected one frozen attempt.");
      }
      await ctx.db.patch(started.attemptId, {
        sectionSnapshots: attempt.sectionSnapshots.map((snapshot) => ({
          ...snapshot,
          sectionRowHash: `${snapshot.sectionRowHash}-drift`,
          sourceRevision: originalSnapshot.sourceRevision,
        })),
      });
    });
    await expect(
      authed.query(api.tryouts.queries.attemptPage.getSet, {
        request: {
          attemptId: started.attemptId,
          kind: "retained",
          locale: "id",
          publicPath: setPublicPath,
        },
      })
    ).rejects.toThrow("TRYOUT_SECTION_SNAPSHOT_MISMATCH");
  });
});
