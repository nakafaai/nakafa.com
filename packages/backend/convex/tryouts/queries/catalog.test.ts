import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout-snapshot";
import {
  activateRenamedTryoutStartSource,
  activateTryoutStartSource,
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
  TRYOUT_RENAMED_SET_PATH,
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
  TRYOUT_EXAM_PATH,
  TRYOUT_SECTION_PATH,
  TRYOUT_SET_PATH,
} from "@repo/backend/test/tryouts";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("tryouts/queries/catalog", () => {
  it("serves the complete signed hierarchy without filesystem catalog rows", async () => {
    const t = convexTest(schema, convexModules);
    const countryPath = `try-out/${TRYOUT_START_COUNTRY}`;
    const examPath = `${countryPath}/${TRYOUT_START_EXAM}`;
    const trackPath = `${examPath}/${TRYOUT_START_TRACK}`;
    const setPath = `${trackPath}/${TRYOUT_START_SET}`;
    const sectionPath = `${setPath}/${TRYOUT_START_SECTION}`;

    await t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"));

    const hub = await t.query(api.tryouts.queries.catalog.getHubPage, {
      locale: "id",
    });
    const country = await t.query(api.tryouts.queries.catalog.getCountryPage, {
      locale: "id",
      publicPath: countryPath,
    });
    const exam = await t.query(api.tryouts.queries.catalog.getExamPage, {
      locale: "id",
      publicPath: examPath,
    });
    const track = await t.query(api.tryouts.queries.catalog.getTrackPage, {
      locale: "id",
      publicPath: trackPath,
    });
    const set = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: setPath,
    });
    const section = await t.query(api.tryouts.queries.catalog.getSectionPage, {
      locale: "id",
      publicPath: sectionPath,
    });

    expect(hub.countries).toEqual([
      expect.objectContaining({
        countryKey: TRYOUT_START_COUNTRY,
        examCount: 1,
      }),
    ]);
    expect(country?.exams).toEqual([
      expect.objectContaining({ examKey: TRYOUT_START_EXAM }),
    ]);
    expect(exam?.tracks).toEqual([
      expect.objectContaining({ trackKey: TRYOUT_START_TRACK }),
    ]);
    expect(track?.track).toMatchObject({ trackKey: TRYOUT_START_TRACK });
    expect(set).toMatchObject({
      entryQuestions: [],
      entrySection: { sectionKey: TRYOUT_START_SECTION },
      set: { setKey: TRYOUT_START_SET },
      sections: [{ sectionKey: TRYOUT_START_SECTION }],
    });
    expect(section).toMatchObject({
      questions: [],
      section: { sectionKey: TRYOUT_START_SECTION },
      set: { setKey: TRYOUT_START_SET },
    });
  });

  it("serves a frozen attempt route after active ownership moves", async () => {
    const t = createConvexTestWithBetterAuth();
    const sectionPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}/${TRYOUT_START_SECTION}`;
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
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        activeManifestHash: undefined,
        activeReleaseId: undefined,
        activeSequence: undefined,
      });
    });

    await expect(
      t.query(api.tryouts.queries.catalog.getSectionPage, {
        locale: "id",
        publicPath: sectionPath,
      })
    ).resolves.toBeNull();
    await expect(
      authed.query(api.tryouts.queries.catalog.getAttemptSectionPage, {
        locale: "id",
        publicPath: sectionPath,
      })
    ).resolves.toMatchObject({
      attemptId: started.attemptId,
      page: {
        section: { sectionKey: TRYOUT_START_SECTION },
        set: { setKey: TRYOUT_START_SET },
      },
    });
  });

  it("serves the exact frozen attempt after its active route is renamed", async () => {
    const t = createConvexTestWithBetterAuth();
    const sectionPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}/${TRYOUT_START_SECTION}`;
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
      authed.query(api.tryouts.queries.catalog.getAttemptSectionPage, {
        locale: "id",
        publicPath: sectionPath,
      })
    ).resolves.toMatchObject({
      attemptId: started.attemptId,
      page: { section: { sectionKey: TRYOUT_START_SECTION } },
    });
    await expect(
      t.query(api.tryouts.queries.catalog.getSectionPage, {
        locale: "id",
        publicPath: `${TRYOUT_RENAMED_SET_PATH}/${TRYOUT_START_SECTION}`,
      })
    ).resolves.toMatchObject({
      section: { sectionKey: TRYOUT_START_SECTION },
    });
  });

  it("fails closed when a signed set loses its internal entry section", async () => {
    const t = convexTest(schema, convexModules);
    const locales: readonly ContentLocale[] = ["en", "id"];
    const catalog = locales.flatMap((locale) =>
      makeTryoutStartHierarchy(locale, "internal-entry").map((row) => {
        if (row.kind !== "set") {
          return row;
        }
        return { ...row, internalEntrySectionKey: "missing" };
      })
    );

    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog,
        placements: locales.map(makeTryoutStartPlacement),
      })
    );

    await expect(
      t.query(api.tryouts.queries.catalog.getSetPage, {
        locale: "id",
        publicPath: `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("hides exam page tracks until their materialized readiness is true", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      await insertTryoutTrack(ctx, {
        isReady: false,
        publicPath: `${TRYOUT_EXAM_PATH}/2028`,
        trackKey: "2028",
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getExamPage, {
      locale: "id",
      publicPath: TRYOUT_EXAM_PATH,
    });

    expect(page?.tracks.map((track) => track.trackKey)).toEqual(["2027"]);
  });

  it("does not expose legacy exam-to-set paths as track pages", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
    });

    const page = await t.query(api.tryouts.queries.catalog.getTrackPage, {
      locale: "id",
      publicPath: `${TRYOUT_EXAM_PATH}/set-1`,
    });

    expect(page).toBeNull();
  });

  it("hides set pages until every section row is synced", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      const setId = await insertTryoutSet(ctx, {
        sectionCount: 2,
        totalQuestionCount: 2,
      });
      const questionSetId = await insertTryoutQuestionSource(ctx);

      await insertTryoutSection(ctx, {
        publicPath: TRYOUT_SECTION_PATH,
        questionSetId,
        tryoutSetId: setId,
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: TRYOUT_SET_PATH,
    });

    expect(page).toBeNull();
  });

  it("hides set pages until section revisions and question totals match", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      const setId = await insertTryoutSet(ctx, {
        totalQuestionCount: 2,
      });
      const questionSetId = await insertTryoutQuestionSource(ctx, {
        sourceRevision: "2025",
      });

      await insertTryoutSection(ctx, {
        publicPath: TRYOUT_SECTION_PATH,
        questionSetId,
        sourceRevision: "2025",
        tryoutSetId: setId,
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: TRYOUT_SET_PATH,
    });

    expect(page).toBeNull();
  });

  it("serves internal-entry set pages without a public section route", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx, {
        publicPath: `${TRYOUT_EXAM_PATH}/matematika`,
        trackKey: "mathematics",
        trackKind: "subject",
      });
      const setId = await insertTryoutSet(ctx, {
        internalEntrySectionKey: "mathematics",
        publicPath: `${TRYOUT_EXAM_PATH}/matematika/set-1`,
        trackKey: "mathematics",
        visibleSectionCount: 0,
      });
      const sourcePath =
        "question-bank/tryout/indonesia/snbt/mathematics/set-1/mathematics";
      const questionSetId = await insertTryoutQuestionSource(ctx, {
        sectionKey: "mathematics",
        sourcePath,
      });

      await insertTryoutSection(ctx, {
        publicPath: undefined,
        questionSetId,
        questionSourcePath: sourcePath,
        sectionKey: "mathematics",
        trackKey: "mathematics",
        tryoutSetId: setId,
        visibility: "internal-entry",
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: `${TRYOUT_EXAM_PATH}/matematika/set-1`,
    });

    expect(page?.sections).toEqual([]);
    expect(page?.entrySection).toMatchObject({
      sectionKey: "mathematics",
      visibility: "internal-entry",
    });
    expect(page?.entrySection?.publicPath).toBeUndefined();
    expect(page?.entryQuestions).toHaveLength(1);
  });

  it("hides direct set and section pages when their country is inactive", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const countryId = await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      const setId = await insertTryoutSet(ctx);
      const questionSetId = await insertTryoutQuestionSource(ctx);

      await insertTryoutSection(ctx, {
        publicPath: TRYOUT_SECTION_PATH,
        questionSetId,
        tryoutSetId: setId,
      });
      await ctx.db.patch(countryId, { isActive: false });
    });

    const setPage = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: TRYOUT_SET_PATH,
    });
    const sectionPage = await t.query(
      api.tryouts.queries.catalog.getSectionPage,
      {
        locale: "id",
        publicPath: TRYOUT_SECTION_PATH,
      }
    );

    expect(setPage).toBeNull();
    expect(sectionPage).toBeNull();
  });
});
