import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

interface SyncedExerciseSet {
  category: Doc<"exerciseSets">["category"];
  contentHash: string;
  description?: string;
  exerciseType: string;
  exerciseTypeTitle: string;
  groupContentHash: string;
  locale: Doc<"exerciseSets">["locale"];
  material: Doc<"exerciseSets">["material"];
  questionCount: number;
  searchDescription: string;
  searchText: string;
  searchTitle: string;
  setName: string;
  slug: string;
  title: string;
  type: Doc<"exerciseSets">["type"];
  year?: string;
}

interface SyncedExerciseQuestion {
  answerBody: string;
  authors: Array<{ name: string }>;
  category: Doc<"exerciseQuestions">["category"];
  choices: {
    en: SyncedExerciseChoice[];
    id: SyncedExerciseChoice[];
  };
  contentHash: string;
  date: number;
  description?: string;
  exerciseType: string;
  locale: Doc<"exerciseQuestions">["locale"];
  material: Doc<"exerciseQuestions">["material"];
  number: number;
  questionBody: string;
  searchDescription: string;
  searchText: string;
  searchTitle: string;
  setName: string;
  setSlug: string;
  slug: string;
  title: string;
  type: Doc<"exerciseQuestions">["type"];
}

interface SyncedExerciseChoice {
  isCorrect: boolean;
  label: string;
  optionKey: string;
  order: number;
}

const SET_SLUG =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1";
const QUESTION_SLUG = `${SET_SLUG}/1`;
const BASE_SET: SyncedExerciseSet = {
  category: "high-school",
  contentHash: "set-hash",
  description: "Old set description",
  exerciseType: "try-out",
  exerciseTypeTitle: "Try Out",
  groupContentHash: "group-hash",
  locale: "id",
  material: "quantitative-knowledge",
  questionCount: 1,
  searchDescription: "Old set description",
  searchText: "Set search text",
  searchTitle: "Old Set Title",
  setName: "set-1",
  slug: SET_SLUG,
  title: "Old Set Title",
  type: "snbt",
  year: "2026",
};
const BASE_QUESTION: SyncedExerciseQuestion = {
  answerBody: "Answer body",
  authors: [{ name: "Ada" }],
  category: "high-school",
  choices: {
    en: [
      {
        isCorrect: true,
        label: "A EN",
        optionKey: "A",
        order: 0,
      },
    ],
    id: [
      {
        isCorrect: true,
        label: "A ID",
        optionKey: "A",
        order: 0,
      },
    ],
  },
  contentHash: "same-question-hash",
  date: 1,
  description: "Old question description",
  exerciseType: "try-out",
  locale: "id",
  material: "quantitative-knowledge",
  number: 1,
  questionBody: "Question body",
  searchDescription: "Old question description",
  searchText: "Question body Answer body",
  searchTitle: "Old Question Title",
  setName: "set-1",
  setSlug: SET_SLUG,
  slug: QUESTION_SLUG,
  title: "Old Question Title",
  type: "snbt",
};

/** Builds a complete exercise set sync payload with focused overrides. */
function buildSet(
  overrides: Partial<SyncedExerciseSet> = {}
): SyncedExerciseSet {
  return { ...BASE_SET, ...overrides };
}

/** Builds a complete exercise question sync payload with focused overrides. */
function buildQuestion(
  overrides: Partial<SyncedExerciseQuestion> = {}
): SyncedExerciseQuestion {
  return { ...BASE_QUESTION, ...overrides };
}

describe("contentSync/mutations/exercises", () => {
  it("syncs exercise sets through create, unchanged, update, and search removal", async () => {
    const t = convexTest(schema, convexModules);

    const created = await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      { sets: [buildSet()] }
    );
    const unchanged = await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      { sets: [buildSet()] }
    );
    const updated = await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      {
        sets: [
          buildSet({
            description: "New set description",
            title: "New Set Title",
          }),
        ],
      }
    );
    const syncedRoute = await t.query(async (ctx) => {
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", `id/${SET_SLUG}`))
        .unique();
      const groupRoute = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq(
            "content_id",
            "id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026"
          )
        )
        .unique();

      return { groupRoute, route };
    });
    const searchRemoved = await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      {
        sets: [
          buildSet({
            description: "Empty set",
            questionCount: 0,
            title: "Empty Set",
          }),
        ],
      }
    );
    const snapshot = await t.query(async (ctx) => {
      const set = await ctx.db
        .query("exerciseSets")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", SET_SLUG)
        )
        .unique();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) => q.eq("content_id", `id/${SET_SLUG}`))
        .unique();
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", `id/${SET_SLUG}`))
        .unique();
      const groupRoute = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq(
            "content_id",
            "id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026"
          )
        )
        .unique();

      return { groupRoute, route, search, set };
    });

    expect(created).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(unchanged).toEqual({ created: 0, unchanged: 1, updated: 0 });
    expect(updated).toEqual({ created: 0, unchanged: 0, updated: 1 });
    expect(syncedRoute.route).toMatchObject({
      kind: "exercise-set",
      route: SET_SLUG,
      title: "New Set Title",
    });
    expect(syncedRoute.groupRoute).toMatchObject({
      contentHash: "group-hash",
      kind: "exercise-group",
      markdown: false,
      route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
      title: "Try Out",
    });
    expect(searchRemoved).toEqual({ created: 0, unchanged: 0, updated: 1 });
    expect(snapshot.set).toMatchObject({
      description: "Empty set",
      questionCount: 0,
      title: "Empty Set",
    });
    expect(snapshot.route).toBeNull();
    expect(snapshot.groupRoute).toBeNull();
    expect(snapshot.search).toBeNull();
  });

  it("syncs exercise questions, skips missing sets, and updates choices", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("authors", { name: "Ada", username: "ada" });
    });
    await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      { sets: [buildSet()] }
    );

    const created = await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseQuestions,
      {
        questions: [
          buildQuestion({ setSlug: `${SET_SLUG}-missing` }),
          buildQuestion(),
        ],
      }
    );
    const unchanged = await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseQuestions,
      { questions: [buildQuestion()] }
    );
    const updated = await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseQuestions,
      {
        questions: [
          buildQuestion({
            choices: {
              en: [
                {
                  isCorrect: false,
                  label: "B EN",
                  optionKey: "B",
                  order: 1,
                },
              ],
              id: [
                {
                  isCorrect: false,
                  label: "B ID",
                  optionKey: "B",
                  order: 1,
                },
              ],
            },
            contentHash: "updated-question-hash",
            date: 2,
            description: "New question description",
            searchDescription: "New question description",
            searchTitle: "New Question Title",
            title: "New Question Title",
          }),
        ],
      }
    );
    const snapshot = await t.query(async (ctx) => {
      const question = await ctx.db
        .query("exerciseQuestions")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", QUESTION_SLUG)
        )
        .unique();

      if (!question) {
        throw new Error("Expected synced exercise question.");
      }

      const choices = await ctx.db
        .query("exerciseChoices")
        .withIndex("by_questionId_and_locale", (q) =>
          q.eq("questionId", question._id)
        )
        .collect();
      const authorLinks = await ctx.db
        .query("contentAuthors")
        .withIndex("by_contentId_and_contentType_and_authorId", (q) =>
          q.eq("contentId", question._id).eq("contentType", "exercise")
        )
        .collect();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", `id/${QUESTION_SLUG}`)
        )
        .unique();
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", `id/${QUESTION_SLUG}`)
        )
        .unique();

      return { authorLinks, choices, question, route, search };
    });

    expect(created).toEqual({
      authorLinksCreated: 1,
      choicesCreated: 2,
      created: 1,
      skipped: 1,
      skippedSetSlugs: [`${SET_SLUG}-missing`],
      unchanged: 0,
      updated: 0,
    });
    expect(unchanged).toMatchObject({ unchanged: 1 });
    expect(updated).toMatchObject({
      authorLinksCreated: 1,
      choicesCreated: 2,
      updated: 1,
    });
    expect(snapshot.question).toMatchObject({
      date: 2,
      description: "New question description",
      title: "New Question Title",
    });
    expect(snapshot.authorLinks).toHaveLength(1);
    expect(snapshot.choices.map((choice) => choice.locale).sort()).toEqual([
      "en",
      "id",
    ]);
    expect(snapshot.choices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "B EN",
          locale: "en",
          optionKey: "B",
        }),
        expect.objectContaining({
          label: "B ID",
          locale: "id",
          optionKey: "B",
        }),
      ])
    );
    expect(snapshot.search).toMatchObject({
      contentHash: "updated-question-hash",
      route: QUESTION_SLUG,
      title: "New Question Title",
    });
    expect(snapshot.route).toMatchObject({
      contentHash: "updated-question-hash",
      kind: "exercise-question",
      route: QUESTION_SLUG,
      title: "New Question Title",
    });
  });

  it("returns empty summaries for empty exercise sync and stale delete batches", async () => {
    const t = convexTest(schema, convexModules);

    const setSync = await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      { sets: [] }
    );
    const questionSync = await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseQuestions,
      { questions: [] }
    );
    const setDelete = await t.mutation(
      internal.contentSync.mutations.exercises.deleteStaleExerciseSets,
      { setIds: [] }
    );
    const questionDelete = await t.mutation(
      internal.contentSync.mutations.exercises.deleteStaleExerciseQuestions,
      { questionIds: [] }
    );

    expect(setSync).toEqual({ created: 0, unchanged: 0, updated: 0 });
    expect(questionSync).toEqual({
      authorLinksCreated: 0,
      choicesCreated: 0,
      created: 0,
      skipped: 0,
      skippedSetSlugs: [],
      unchanged: 0,
      updated: 0,
    });
    expect(setDelete).toEqual({ deleted: 0 });
    expect(questionDelete).toEqual({ deleted: 0 });
  });

  it("deletes stale exercise questions and skips IDs that already disappeared", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("authors", { name: "Ada", username: "ada" });
    });
    await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      { sets: [buildSet()] }
    );
    await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseQuestions,
      { questions: [buildQuestion()] }
    );
    const ids = await t.mutation(async (ctx) => {
      const set = await ctx.db
        .query("exerciseSets")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", SET_SLUG)
        )
        .unique();
      const question = await ctx.db
        .query("exerciseQuestions")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", QUESTION_SLUG)
        )
        .unique();

      if (!(set && question)) {
        throw new Error(
          "Expected synced exercise question before stale delete."
        );
      }

      const missingId = await ctx.db.insert("exerciseQuestions", {
        answerBody: "Missing answer",
        category: "high-school",
        contentHash: "missing-hash",
        date: 1,
        exerciseType: "try-out",
        locale: "id",
        material: "quantitative-knowledge",
        number: 99,
        questionBody: "Missing question",
        setId: set._id,
        setName: "set-1",
        slug: `${SET_SLUG}/99`,
        syncedAt: 1,
        title: "Missing",
        type: "snbt",
      });
      await ctx.db.delete("exerciseQuestions", missingId);

      return { missingId, questionId: question._id };
    });

    const result = await t.mutation(
      internal.contentSync.mutations.exercises.deleteStaleExerciseQuestions,
      { questionIds: [ids.questionId, ids.missingId] }
    );
    const snapshot = await t.query(async (ctx) => {
      const question = await ctx.db.get(ids.questionId);
      const choices = await ctx.db
        .query("exerciseChoices")
        .withIndex("by_questionId_and_locale", (q) =>
          q.eq("questionId", ids.questionId).eq("locale", "id")
        )
        .collect();
      const authorLinks = await ctx.db
        .query("contentAuthors")
        .withIndex("by_contentId_and_contentType_and_authorId", (q) =>
          q.eq("contentId", ids.questionId).eq("contentType", "exercise")
        )
        .collect();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", `id/${QUESTION_SLUG}`)
        )
        .unique();
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", `id/${QUESTION_SLUG}`)
        )
        .unique();

      return { authorLinks, choices, question, route, search };
    });

    expect(result).toEqual({ deleted: 1 });
    expect(snapshot).toEqual({
      authorLinks: [],
      choices: [],
      question: null,
      route: null,
      search: null,
    });
  });

  it("deletes stale exercise sets with questions and rejects unsafe question counts", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("authors", { name: "Ada", username: "ada" });
    });
    await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      { sets: [buildSet(), buildSet({ slug: `${SET_SLUG}-unsafe` })] }
    );
    await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseQuestions,
      { questions: [buildQuestion()] }
    );
    const ids = await t.mutation(async (ctx) => {
      const set = await ctx.db
        .query("exerciseSets")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", SET_SLUG)
        )
        .unique();
      const unsafeSet = await ctx.db
        .query("exerciseSets")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", `${SET_SLUG}-unsafe`)
        )
        .unique();
      const missingId = await ctx.db.insert("exerciseSets", {
        category: "high-school",
        exerciseType: "try-out",
        locale: "id",
        material: "quantitative-knowledge",
        questionCount: 0,
        setName: "missing",
        slug: `${SET_SLUG}-missing`,
        syncedAt: 1,
        title: "Missing",
        type: "snbt",
      });

      if (!(set && unsafeSet)) {
        throw new Error("Expected synced exercise sets before stale delete.");
      }

      await ctx.db.patch("exerciseSets", unsafeSet._id, { questionCount: 0 });
      await ctx.db.insert("exerciseQuestions", {
        answerBody: "Unsafe answer",
        category: "high-school",
        contentHash: "unsafe-hash",
        date: 1,
        exerciseType: "try-out",
        locale: "id",
        material: "quantitative-knowledge",
        number: 1,
        questionBody: "Unsafe question",
        setId: unsafeSet._id,
        setName: "set-1",
        slug: `${SET_SLUG}-unsafe/1`,
        syncedAt: 1,
        title: "Unsafe",
        type: "snbt",
      });
      await ctx.db.delete("exerciseSets", missingId);

      return { missingId, setId: set._id, unsafeSetId: unsafeSet._id };
    });

    await expect(
      t.mutation(
        internal.contentSync.mutations.exercises.deleteStaleExerciseSets,
        { setIds: [ids.unsafeSetId] }
      )
    ).rejects.toThrow("CONTENT_SYNC_QUESTION_COUNT_EXCEEDED");

    const result = await t.mutation(
      internal.contentSync.mutations.exercises.deleteStaleExerciseSets,
      { setIds: [ids.setId, ids.missingId] }
    );
    const snapshot = await t.query(async (ctx) => {
      const set = await ctx.db.get(ids.setId);
      const question = await ctx.db
        .query("exerciseQuestions")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", QUESTION_SLUG)
        )
        .unique();
      const setSearch = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) => q.eq("content_id", `id/${SET_SLUG}`))
        .unique();
      const questionSearch = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", `id/${QUESTION_SLUG}`)
        )
        .unique();
      const setRoute = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", `id/${SET_SLUG}`))
        .unique();
      const questionRoute = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", `id/${QUESTION_SLUG}`)
        )
        .unique();

      return {
        question,
        questionRoute,
        questionSearch,
        set,
        setRoute,
        setSearch,
      };
    });

    expect(result).toEqual({ deleted: 1 });
    expect(snapshot).toEqual({
      question: null,
      questionRoute: null,
      questionSearch: null,
      set: null,
      setRoute: null,
      setSearch: null,
    });
  });
});
