import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { SyncedQuestion } from "@repo/backend/convex/contentSync/tryouts/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import type { TryoutRouteKind } from "@repo/contents/_types/tryout/schema";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const COUNTRY_ROUTE = "try-out/indonesia";
const EXAM_ROUTE = `${COUNTRY_ROUTE}/snbt`;
const TRACK_ROUTE = `${EXAM_ROUTE}/2027`;
const SET_ROUTE = `${TRACK_ROUTE}/set-1`;
const SECTION_ROUTE = `${SET_ROUTE}/penalaran-matematika`;
const SECTION_SOURCE =
  "question-bank/tryout/indonesia/snbt/2027/set-1/penalaran-matematika";
const SECTION_GRAPH = getGraphIdentity(SECTION_ROUTE);

/** Builds one route projection fixture matching try-out source routes. */
function buildRoute(source: {
  description?: string;
  kind: TryoutRouteKind;
  publicPath: string;
  title: string;
}) {
  return {
    contentHash: `${source.publicPath}:hash`,
    description: source.description,
    isReady: true,
    kind: source.kind,
    locale: "id" as const,
    publicPath: source.publicPath,
    sourcePath: source.publicPath,
    title: source.title,
  };
}

/** Builds a minimal try-out sync payload with one section. */
function buildSyncPayload() {
  return {
    countries: [
      {
        countryKey: "indonesia",
        description: "Ujian Indonesia",
        isActive: true,
        locale: "id" as const,
        order: 1,
        publicPath: COUNTRY_ROUTE,
        sourceRevision: "2026",
        title: "Indonesia",
      },
    ],
    exams: [
      {
        countryKey: "indonesia",
        description: "Seleksi nasional",
        examKey: "snbt",
        isActive: true,
        locale: "id" as const,
        order: 1,
        publicPath: EXAM_ROUTE,
        scoringStrategy: "irt" as const,
        sourceRevision: "2026",
        title: "SNBT",
      },
    ],
    questionSets: [
      {
        contentHash: "question-set-hash",
        countryKey: "indonesia",
        description: "Penalaran matematika",
        examKey: "snbt",
        locale: "id" as const,
        questionCount: 20,
        sectionKey: "penalaran-matematika",
        setKey: "set-1",
        sourcePath: SECTION_SOURCE,
        sourceRevision: "2026",
        title: "Penalaran Matematika",
      },
    ],
    questions: [],
    routes: [
      buildRoute({
        description: "Ujian Indonesia",
        kind: "tryout-country",
        publicPath: COUNTRY_ROUTE,
        title: "Indonesia",
      }),
      buildRoute({
        description: "Seleksi nasional",
        kind: "tryout-exam",
        publicPath: EXAM_ROUTE,
        title: "SNBT",
      }),
      buildRoute({
        kind: "tryout-track",
        publicPath: TRACK_ROUTE,
        title: "Tahun 2027",
      }),
      buildRoute({
        kind: "tryout-set",
        publicPath: SET_ROUTE,
        title: "Set 1",
      }),
      buildRoute({
        description: "Penalaran matematika",
        kind: "tryout-section",
        publicPath: SECTION_ROUTE,
        title: "Penalaran Matematika",
      }),
    ],
    sections: [
      {
        countryKey: "indonesia",
        description: "Penalaran matematika",
        examKey: "snbt",
        locale: "id" as const,
        order: 1,
        publicPath: SECTION_ROUTE,
        questionCount: 20,
        questionSourcePath: SECTION_SOURCE,
        sectionKey: "penalaran-matematika",
        setKey: "set-1",
        sourceRevision: "2026",
        timeLimitSeconds: 1800,
        title: "Penalaran Matematika",
        trackKey: "2027",
        visibility: "visible" as const,
      },
    ],
    sets: [
      {
        countryKey: "indonesia",
        examKey: "snbt",
        isActive: true,
        locale: "id" as const,
        order: 1,
        publicPath: SET_ROUTE,
        scoringStrategy: "irt" as const,
        readyQuestionCount: 20,
        readyVisibleSectionCount: 1,
        sectionCount: 1,
        setKey: "set-1",
        sourceRevision: "2026",
        title: "Set 1",
        trackKey: "2027",
        totalQuestionCount: 20,
        visibleSectionCount: 1,
        isReady: true,
      },
    ],
    tracks: [
      {
        authoredSetCount: 1,
        countryKey: "indonesia",
        description: "Try-out SNBT Tahun 2027",
        examKey: "snbt",
        isActive: true,
        isReady: true,
        locale: "id" as const,
        order: 1,
        publicPath: TRACK_ROUTE,
        readyQuestionCount: 20,
        readySetCount: 1,
        readyVisibleSectionCount: 1,
        sourceRevision: "2026",
        title: "Tahun 2027",
        trackKey: "2027",
        trackKind: "year" as const,
      },
    ],
  };
}

/** Builds the same section as an internal entry with no public route. */
function buildInternalEntryPayload() {
  const payload = buildSyncPayload();

  return {
    ...payload,
    routes: payload.routes.filter((route) => route.kind !== "tryout-section"),
    sections: payload.sections.map(
      ({ description: _description, ...section }) => ({
        ...section,
        publicPath: undefined,
        visibility: "internal-entry" as const,
      })
    ),
    sets: payload.sets.map((set) => ({
      ...set,
      internalEntrySectionKey: "penalaran-matematika",
      readyVisibleSectionCount: 0,
      visibleSectionCount: 0,
    })),
    tracks: payload.tracks.map((track) => ({
      ...track,
      readyVisibleSectionCount: 0,
    })),
  };
}

/** Builds one synced try-out question fixture for the IRT scale snapshot. */
function buildQuestion(number: number): SyncedQuestion {
  const sourcePath = `${SECTION_SOURCE}/question-${number}`;

  return {
    answerBody: `Answer ${number}`,
    authors: [],
    choices: [
      {
        isCorrect: true,
        label: "A",
        optionKey: "a",
        order: 1,
      },
      {
        isCorrect: false,
        label: "B",
        optionKey: "b",
        order: 2,
      },
    ],
    contentHash: `question-${number}:hash`,
    date: 0,
    description: `Question ${number}`,
    locale: "id",
    number,
    questionBody: `Question ${number}`,
    questionSetSourcePath: SECTION_SOURCE,
    sourceKey: `${SECTION_SOURCE}:question-${number}`,
    sourcePath,
    sourceRevision: "2026",
    title: `Question ${number}`,
  };
}

/** Builds the complete question payload for the one-section fixture. */
function buildQuestions() {
  return Array.from({ length: 20 }, (_, index) => buildQuestion(index + 1));
}

/** Returns the graph identity for a test route. */
function getGraphIdentity(route: string) {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route,
  });

  if (!identity) {
    throw new Error(`Expected graph identity for ${route}.`);
  }

  return identity;
}

describe("contentSync/mutations/tryouts", () => {
  it("syncs try-out catalog routes with readable search projections", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      buildSyncPayload()
    );
    const snapshot = await t.query(async (ctx) => {
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_GRAPH.assetId)
        )
        .unique();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_GRAPH.assetId)
        )
        .unique();

      return { route, search };
    });

    expect(result).toEqual({ created: 6, unchanged: 0, updated: 0 });
    expect(snapshot.route).toMatchObject({
      contentHash: `${SECTION_ROUTE}:hash`,
      kind: "tryout-section",
      markdown: false,
      route: SECTION_ROUTE,
      section: "tryout",
      sourcePath: SECTION_ROUTE,
      title: "Penalaran Matematika",
    });
    expect(snapshot.search).toMatchObject({
      contentHash: `${SECTION_ROUTE}:hash`,
      route: SECTION_ROUTE,
      section: "tryout",
      sourcePath: SECTION_ROUTE,
      title: "Penalaran Matematika",
    });
    expect(snapshot.search?.text).toContain("Penalaran Matematika");
    expect(snapshot.search?.text).toContain(SECTION_ROUTE);
  });

  it("deletes stale try-out sections before their question sets", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      buildSyncPayload()
    );
    const ids = await t.query(async (ctx) => {
      const section = await ctx.db
        .query("tryoutSections")
        .withIndex("by_locale_and_publicPath", (q) =>
          q.eq("locale", "id").eq("publicPath", SECTION_ROUTE)
        )
        .unique();
      const questionSet = await ctx.db
        .query("questionSets")
        .withIndex("by_locale_and_sourcePath", (q) =>
          q.eq("locale", "id").eq("sourcePath", SECTION_SOURCE)
        )
        .unique();

      if (!(section && questionSet)) {
        throw new Error("Expected synced try-out section and question set.");
      }

      return {
        questionSetId: questionSet._id,
        sectionId: section._id,
      };
    });

    const sectionResult = await t.mutation(
      internal.contentSync.mutations.tryouts.deleteStaleTryoutSections,
      { sectionIds: [ids.sectionId] }
    );
    const questionSetResult = await t.mutation(
      internal.contentSync.mutations.tryouts.deleteStaleQuestionSets,
      { questionSetIds: [ids.questionSetId] }
    );
    const snapshot = await t.query(async (ctx) => {
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_GRAPH.assetId)
        )
        .unique();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_GRAPH.assetId)
        )
        .unique();
      const section: Doc<"tryoutSections"> | null = await ctx.db.get(
        ids.sectionId
      );
      const questionSet: Doc<"questionSets"> | null = await ctx.db.get(
        ids.questionSetId
      );

      return { questionSet, route, search, section };
    });

    expect(sectionResult).toEqual({ deleted: 1 });
    expect(questionSetResult).toEqual({ deleted: 1 });
    expect(snapshot).toEqual({
      questionSet: null,
      route: null,
      search: null,
      section: null,
    });
  });

  it("deletes stale section projections when a section becomes internal-entry", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      buildSyncPayload()
    );
    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      buildInternalEntryPayload()
    );
    const snapshot = await t.query(async (ctx) => {
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_GRAPH.assetId)
        )
        .unique();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_GRAPH.assetId)
        )
        .unique();
      const set = await ctx.db
        .query("tryoutSets")
        .withIndex("by_locale_and_publicPath", (q) =>
          q.eq("locale", "id").eq("publicPath", SET_ROUTE)
        )
        .unique();

      if (!set) {
        throw new Error("Expected synced try-out set.");
      }

      const section = await ctx.db
        .query("tryoutSections")
        .withIndex("by_tryoutSetId_and_sectionKey", (q) =>
          q.eq("tryoutSetId", set._id).eq("sectionKey", "penalaran-matematika")
        )
        .unique();

      return { route, search, section };
    });

    expect(snapshot.route).toBeNull();
    expect(snapshot.search).toBeNull();
    expect(snapshot.section).toMatchObject({
      visibility: "internal-entry",
    });
    expect(snapshot.section).not.toHaveProperty("description");
    expect(snapshot.section).not.toHaveProperty("publicPath");
  });

  it("provisions one source-snapshot IRT scale for synced questions", async () => {
    const t = convexTest(schema, convexModules);
    const payload = {
      ...buildSyncPayload(),
      questions: buildQuestions(),
    };

    const firstResult = await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      payload
    );
    const secondResult = await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      payload
    );
    const snapshot = await t.query(async (ctx) => {
      const set = await ctx.db
        .query("tryoutSets")
        .withIndex("by_locale_and_publicPath", (q) =>
          q.eq("locale", "id").eq("publicPath", SET_ROUTE)
        )
        .unique();

      if (!set) {
        throw new Error("Expected synced try-out set.");
      }

      const scales = await ctx.db
        .query("irtScaleVersions")
        .withIndex("by_tryoutSetId_and_publishedAt", (q) =>
          q.eq("tryoutSetId", set._id)
        )
        .take(2);

      if (scales.length !== 1) {
        return { itemCount: 0, scales };
      }

      const items = await ctx.db
        .query("irtScaleItems")
        .withIndex("by_scaleVersionId_and_questionSourceKey", (q) =>
          q.eq("scaleVersionId", scales[0]._id)
        )
        .take(21);

      return { itemCount: items.length, scales };
    });

    expect(firstResult).toEqual({ created: 26, unchanged: 0, updated: 0 });
    expect(secondResult).toEqual({ created: 0, unchanged: 26, updated: 0 });
    expect(snapshot.scales).toHaveLength(1);
    expect(snapshot.scales[0]).toMatchObject({
      model: "2pl",
      questionCount: 20,
      status: "provisional",
    });
    expect(snapshot.itemCount).toBe(20);
  });
});
