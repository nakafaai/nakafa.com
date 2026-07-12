import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { questionResetBatchSize } from "@repo/backend/convex/contentSync/reset/spec";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import {
  deleteQuestionRows,
  deleteTryoutContentRouteCountRows,
  deleteTryoutContentRoutePageRows,
  deleteTryoutContentRouteRows,
  deleteTryoutContentSearchRows,
} from "./impl";

describe("contentSync/reset/tryouts", () => {
  it("clears only try-out route projections during reset", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(seedTryoutRouteProjections);

    const routeDelete = await t.mutation(deleteTryoutContentRouteRows);
    const searchDelete = await t.mutation(deleteTryoutContentSearchRows);
    const countDelete = await t.mutation(deleteTryoutContentRouteCountRows);
    const pageDelete = await t.mutation(deleteTryoutContentRoutePageRows);
    const rows = await t.query(getProjectionRows);

    expect(routeDelete).toEqual({ deleted: 1, hasMore: false });
    expect(searchDelete).toEqual({ deleted: 1, hasMore: false });
    expect(countDelete).toEqual({ deleted: 1, hasMore: false });
    expect(pageDelete).toEqual({ deleted: 1, hasMore: false });
    expect(rows).toEqual({
      contentRouteCounts: [expect.objectContaining({ section: "articles" })],
      contentRoutePages: [expect.objectContaining({ section: "articles" })],
      contentRoutes: [expect.objectContaining({ section: "articles" })],
      contentSearch: [expect.objectContaining({ section: "articles" })],
    });
  });

  it("deletes questions through their dependent rows", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await seedQuestionWithDependents(ctx, 1);
    });

    const result = await t.mutation(deleteQuestionRows);
    const rows = await t.query(getQuestionRows);

    expect(result).toEqual({ deleted: 1, hasMore: false });
    expect(rows).toEqual({
      contentAuthors: [],
      contentRoutes: [],
      contentSearch: [],
      questionChoices: [],
      questions: [],
    });
  });

  it("paginates question deletion below the dependent choice read limit", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      for (let index = 1; index <= questionResetBatchSize + 1; index += 1) {
        await seedQuestionWithDependents(ctx, index);
      }
    });

    const firstBatch = await t.mutation(deleteQuestionRows);
    const secondBatch = await t.mutation(deleteQuestionRows);
    const rows = await t.query(getQuestionRows);

    expect(firstBatch).toEqual({
      deleted: questionResetBatchSize,
      hasMore: true,
    });
    expect(secondBatch).toEqual({ deleted: 1, hasMore: false });
    expect(rows.questions).toEqual([]);
    expect(rows.questionChoices).toEqual([]);
  });
});

/** Seeds try-out and non-try-out route projection rows. */
async function seedTryoutRouteProjections(ctx: MutationCtx) {
  await insertProjectedRoute(ctx, {
    kind: "tryout-set",
    route: "try-out/indonesia/snbt/2027/set-1",
    section: "tryout",
  });
  await insertProjectedRoute(ctx, {
    kind: "article",
    route: "artikel/fixture",
    section: "articles",
  });
}

/** Seeds one question with the dependent rows owned by question cleanup. */
async function seedQuestionWithDependents(ctx: MutationCtx, index: number) {
  const setKey = `set-${index}`;
  const sourcePath = `try-out/indonesia/snbt/2027/${setKey}/pengetahuan-kuantitatif`;
  const questionSetId = await ctx.db.insert("questionSets", {
    contentHash: "question-set-hash",
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    questionCount: 1,
    sectionKey: "pengetahuan-kuantitatif",
    setKey,
    sourcePath,
    sourceRevision: "2026",
    syncedAt: 1,
    title: "Pengetahuan Kuantitatif",
  });
  const questionId = await ctx.db.insert("questions", {
    answerBody: "Jawaban",
    contentHash: "question-hash",
    date: 1,
    locale: "id",
    number: 1,
    questionBody: "Pertanyaan",
    questionSetId,
    sourceKey: `tryout:question:${index}`,
    sourcePath: `${sourcePath}/1`,
    sourceRevision: "2026",
    syncedAt: 1,
    title: "Pertanyaan 1",
  });
  const authorId = await ctx.db.insert("authors", {
    name: "Nakafa Author",
    username: "nakafa-author",
  });

  await ctx.db.insert("questionChoices", {
    isCorrect: true,
    label: "A",
    locale: "id",
    optionKey: "a",
    order: 1,
    questionId,
  });
  await ctx.db.insert("contentAuthors", {
    authorId,
    contentId: questionId,
    contentType: "question",
    order: 0,
  });
  await insertQuestionProjection(ctx, {
    questionId,
    route: `${sourcePath}/1`,
  });
}

/** Inserts one route projection row family for the requested section. */
async function insertProjectedRoute(
  ctx: MutationCtx,
  args: {
    kind: "article" | "tryout-set";
    route: string;
    section: "articles" | "tryout";
  }
) {
  const graph = projectionGraph(args.route);

  await ctx.db.insert("contentRoutes", {
    ...graph,
    authors: [],
    contentHash: `${args.section}:route-hash`,
    kind: args.kind,
    locale: "id",
    markdown: args.section !== "tryout",
    route: args.route,
    section: args.section,
    sourcePath: args.route,
    syncedAt: 1,
    title: `${args.section} route`,
  });
  await ctx.db.insert(
    "contentSearch",
    buildContentSearchDocument({
      ...graph,
      contentHash: `${args.section}:search-hash`,
      locale: "id",
      route: args.route,
      section: args.section,
      sourcePath: args.route,
      syncedAt: 1,
      text: `${args.section} body`,
      title: `${args.section} search`,
    })
  );
  await ctx.db.insert("contentRouteCounts", {
    count: 1,
    locale: "id",
    section: args.section,
    syncedAt: 1,
  });
  await ctx.db.insert("contentRoutePages", {
    locale: "id",
    page: 0,
    routeCount: 0,
    routes: [],
    section: args.section,
    syncedAt: 1,
  });
}

/** Inserts question route and search projections matching deleteQuestion. */
async function insertQuestionProjection(
  ctx: MutationCtx,
  args: {
    questionId: Id<"questions">;
    route: string;
  }
) {
  const graph = projectionGraph(args.route);

  await ctx.db.insert("contentRoutes", {
    ...graph,
    authors: [],
    contentHash: "question-route-hash",
    kind: "tryout-set",
    locale: "id",
    markdown: false,
    route: args.route,
    section: "tryout",
    sourcePath: args.route,
    syncedAt: 1,
    title: `Question ${args.questionId}`,
  });
  await ctx.db.insert(
    "contentSearch",
    buildContentSearchDocument({
      ...graph,
      contentHash: "question-search-hash",
      locale: "id",
      route: args.route,
      section: "tryout",
      sourcePath: args.route,
      syncedAt: 1,
      text: "Question body",
      title: "Question search",
    })
  );
}

/** Builds stable graph-like identity fields for reset fixtures. */
function projectionGraph(route: string) {
  const key = route.replaceAll("/", ":");

  return {
    alignmentId: `alignment:${key}`,
    assetId: `asset:${key}`,
    conceptId: `concept:${key}`,
    content_id: `asset:${key}`,
    learningObjectId: `lo:${key}`,
    lensId: `lens:${key}`,
  };
}

/** Reads route projection rows after targeted try-out reset runs. */
async function getProjectionRows(ctx: QueryCtx) {
  return {
    contentRouteCounts: await ctx.db.query("contentRouteCounts").collect(),
    contentRoutePages: await ctx.db.query("contentRoutePages").collect(),
    contentRoutes: await ctx.db.query("contentRoutes").collect(),
    contentSearch: await ctx.db.query("contentSearch").collect(),
  };
}

/** Reads question-owned rows after dependent cleanup runs. */
async function getQuestionRows(ctx: QueryCtx) {
  return {
    contentAuthors: await ctx.db.query("contentAuthors").collect(),
    contentRoutes: await ctx.db.query("contentRoutes").collect(),
    contentSearch: await ctx.db.query("contentSearch").collect(),
    questionChoices: await ctx.db.query("questionChoices").collect(),
    questions: await ctx.db.query("questions").collect(),
  };
}
