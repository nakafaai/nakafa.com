import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  activateRenamedTryoutStartSource,
  activateReusedTryoutStartPath,
  activateTryoutStartSource,
  TRYOUT_RENAMED_SET_PATH,
  TRYOUT_REUSED_SECTION,
  TRYOUT_REUSED_SET,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-source";
import {
  insertTryoutCountry,
  insertTryoutExam,
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
  insertTryoutTrack,
} from "@repo/backend/test/tryouts";
import { describe, expect, it } from "vitest";

const setPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const sectionPath = `${setPath}/${TRYOUT_START_SECTION}`;

describe("tryouts/queries/retained", () => {
  it("serves a frozen direct-entry set after its public route changes", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: 1_780_000_000_000,
        suffix: "frozen-entry-set",
      });
      await activateTryoutStartSource(ctx, "internal-entry");
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      {
        countryKey: TRYOUT_START_COUNTRY,
        entrySectionKey: TRYOUT_START_SECTION,
        examKey: TRYOUT_START_EXAM,
        locale: "id",
        setKey: TRYOUT_START_SET,
        trackKey: TRYOUT_START_TRACK,
      }
    );
    expect(started.navigation.publicPath).toBe(setPath);

    await t.mutation(activateRenamedTryoutStartSource);
    await expect(
      authed.query(api.tryouts.queries.retained.getAttemptSetPage, {
        locale: "id",
        publicPath: TRYOUT_RENAMED_SET_PATH,
      })
    ).resolves.toMatchObject({ attemptId: started.attemptId });
    await expect(
      authed.query(api.tryouts.queries.retained.getAttemptSetPage, {
        attemptId: started.attemptId,
        locale: "id",
        publicPath: setPath,
      })
    ).resolves.toMatchObject({
      activeSetPublicPath: TRYOUT_RENAMED_SET_PATH,
      attemptId: started.attemptId,
      page: {
        entrySection: {
          sectionKey: TRYOUT_START_SECTION,
          visibility: "internal-entry",
        },
        sections: [],
        set: { setKey: TRYOUT_START_SET },
      },
    });

    await t.mutation(activateReusedTryoutStartPath);
    await expect(
      authed.query(api.tryouts.queries.retained.getAttemptSetPage, {
        locale: "id",
        publicPath: setPath,
      })
    ).resolves.toBeNull();
    await expect(
      authed.query(api.tryouts.queries.retained.getAttemptSetPage, {
        attemptId: started.attemptId,
        locale: "id",
        publicPath: setPath,
      })
    ).resolves.toMatchObject({
      activeSetPublicPath: null,
      attemptId: started.attemptId,
      page: { set: { setKey: TRYOUT_START_SET } },
    });
    await t.mutation((ctx) =>
      ctx.db.patch(started.attemptId, { completedAt: 1, status: "completed" })
    );
    await expect(
      authed.query(api.tryouts.queries.retained.getAttemptSetPage, {
        locale: "id",
        publicPath: setPath,
      })
    ).resolves.toBeNull();
  });

  it("resolves filesystem destinations after active ownership moves", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: 1_780_000_000_000,
        suffix: "frozen-section",
      });
      await activateTryoutStartSource(ctx, "visible");
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      {
        countryKey: TRYOUT_START_COUNTRY,
        examKey: TRYOUT_START_EXAM,
        locale: "id",
        setKey: TRYOUT_START_SET,
        trackKey: TRYOUT_START_TRACK,
      }
    );
    const filesystem = await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        activeManifestHash: undefined,
        activeReleaseId: undefined,
        activeSequence: undefined,
      });
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx, TRYOUT_START_EXAM);
      await insertTryoutTrack(ctx, {
        examKey: TRYOUT_START_EXAM,
        publicPath: `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}`,
        trackKey: TRYOUT_START_TRACK,
        trackKind: "subject",
      });
      const setId = await insertTryoutSet(ctx, {
        examKey: TRYOUT_START_EXAM,
        publicPath: TRYOUT_RENAMED_SET_PATH,
        trackKey: TRYOUT_START_TRACK,
      });
      const sourcePath = `question-bank/tryout/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}/${TRYOUT_START_SECTION}`;
      const questionSetId = await insertTryoutQuestionSource(ctx, {
        examKey: TRYOUT_START_EXAM,
        sectionKey: TRYOUT_START_SECTION,
        sourcePath,
      });
      const sectionId = await insertTryoutSection(ctx, {
        examKey: TRYOUT_START_EXAM,
        publicPath: `${TRYOUT_RENAMED_SET_PATH}/${TRYOUT_START_SECTION}`,
        questionSetId,
        sectionKey: TRYOUT_START_SECTION,
        trackKey: TRYOUT_START_TRACK,
        tryoutSetId: setId,
      });
      return { sectionId, setId };
    });
    await expect(
      t.query(api.tryouts.queries.catalog.getSectionPage, {
        locale: "id",
        publicPath: sectionPath,
      })
    ).resolves.toBeNull();
    await expect(
      authed.query(api.tryouts.queries.retained.getAttemptSectionPage, {
        locale: "id",
        publicPath: sectionPath,
      })
    ).resolves.toMatchObject({
      activeSectionPublicPath: `${TRYOUT_RENAMED_SET_PATH}/${TRYOUT_START_SECTION}`,
      activeSetPublicPath: TRYOUT_RENAMED_SET_PATH,
      attemptId: started.attemptId,
      page: {
        section: { sectionKey: TRYOUT_START_SECTION },
        set: { setKey: TRYOUT_START_SET },
      },
    });

    await t.mutation((ctx) =>
      ctx.db.patch("tryoutSections", filesystem.sectionId, {
        sectionKey: "replacement",
      })
    );
    await expect(
      authed.query(api.tryouts.queries.retained.getAttemptSectionPage, {
        locale: "id",
        publicPath: sectionPath,
      })
    ).resolves.toMatchObject({
      activeSectionPublicPath: null,
      activeSetPublicPath: TRYOUT_RENAMED_SET_PATH,
    });
    await t.mutation((ctx) =>
      ctx.db.patch("tryoutSets", filesystem.setId, { isReady: false })
    );
    await expect(
      authed.query(api.tryouts.queries.retained.getAttemptSectionPage, {
        locale: "id",
        publicPath: sectionPath,
      })
    ).resolves.toMatchObject({
      activeSectionPublicPath: null,
      activeSetPublicPath: null,
    });
  });

  it("serves a frozen section after its public route changes owner", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: 1_780_000_000_000,
        suffix: "renamed-frozen-section",
      });
      await activateTryoutStartSource(ctx, "visible");
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      {
        countryKey: TRYOUT_START_COUNTRY,
        examKey: TRYOUT_START_EXAM,
        locale: "id",
        setKey: TRYOUT_START_SET,
        trackKey: TRYOUT_START_TRACK,
      }
    );
    await t.mutation(activateRenamedTryoutStartSource);
    await expect(
      authed.query(api.tryouts.queries.retained.getAttemptSectionPage, {
        locale: "id",
        publicPath: sectionPath,
      })
    ).resolves.toMatchObject({
      activeSectionPublicPath: `${TRYOUT_RENAMED_SET_PATH}/${TRYOUT_START_SECTION}`,
      activeSetPublicPath: TRYOUT_RENAMED_SET_PATH,
      attemptId: started.attemptId,
      page: { section: { sectionKey: TRYOUT_START_SECTION } },
    });

    await t.mutation(activateReusedTryoutStartPath);
    const active = await t.query(api.tryouts.queries.catalog.getSectionPage, {
      locale: "id",
      publicPath: sectionPath,
    });
    const retained = await authed.query(
      api.tryouts.queries.retained.getAttemptSectionPage,
      { locale: "id", publicPath: sectionPath }
    );
    expect(active).toMatchObject({
      section: { sectionKey: TRYOUT_REUSED_SECTION },
      set: { setKey: TRYOUT_REUSED_SET },
    });
    expect(retained).toBeNull();
    await t.mutation((ctx) =>
      ctx.db.patch(started.attemptId, { completedAt: 1, status: "completed" })
    );
    await expect(
      authed.query(api.tryouts.queries.retained.getAttemptSectionPage, {
        attemptId: started.attemptId,
        locale: "id",
        publicPath: sectionPath,
      })
    ).resolves.toMatchObject({ attemptId: started.attemptId });
  });
});
