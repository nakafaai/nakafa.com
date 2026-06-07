import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { exerciseSetIntegrityErrorCode } from "@repo/backend/convex/exercises/renderable/spec";
import { SUPPORTED_CONTENT_LOCALES } from "@repo/backend/convex/lib/validators/contents";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const exerciseSetSlug =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1";
const testLocale = SUPPORTED_CONTENT_LOCALES[1];

/**
 * Inserts one synced exercise set for query tests.
 */
async function insertExerciseSet(ctx: MutationCtx, questionCount: number) {
  return await ctx.db.insert("exerciseSets", {
    category: "high-school",
    exerciseType: "try-out",
    locale: testLocale,
    material: "quantitative-knowledge",
    questionCount,
    setName: "set-1",
    slug: exerciseSetSlug,
    syncedAt: NOW,
    title: "Set 1",
    type: "snbt",
  });
}

/**
 * Inserts one synced exercise question under a set.
 */
async function insertExerciseQuestion(
  ctx: MutationCtx,
  setId: Awaited<ReturnType<typeof insertExerciseSet>>,
  number: number
) {
  return await ctx.db.insert("exerciseQuestions", {
    answerBody: `Answer ${number}`,
    category: "high-school",
    contentHash: `hash-${number}`,
    date: NOW,
    exerciseType: "try-out",
    locale: testLocale,
    material: "quantitative-knowledge",
    number,
    questionBody: `Question ${number}`,
    setId,
    setName: "set-1",
    slug: `${exerciseSetSlug}/${number}`,
    syncedAt: NOW,
    title: `Question ${number}`,
    type: "snbt",
  });
}

/**
 * Inserts one synced choice row under a question.
 */
async function insertExerciseChoice(
  ctx: MutationCtx,
  questionId: Awaited<ReturnType<typeof insertExerciseQuestion>>,
  order: number
) {
  await ctx.db.insert("exerciseChoices", {
    isCorrect: order === 0,
    label: `Choice ${order + 1}`,
    locale: testLocale,
    optionKey: String.fromCharCode(65 + order),
    order,
    questionId,
  });
}

/**
 * Loads renderable rows for the shared fixture set.
 */
function queryRenderableRows(t: ReturnType<typeof convexTest>) {
  return t.query(api.exercises.queries.getRenderableRowsBySlug, {
    locale: testLocale,
    slug: exerciseSetSlug,
  });
}

/**
 * Asserts one structured synced-content integrity failure.
 */
async function expectIntegrityError(
  promise: ReturnType<typeof queryRenderableRows>,
  message: string
) {
  await expect(promise).rejects.toMatchObject({
    data: {
      code: exerciseSetIntegrityErrorCode,
      message,
    },
  });
}

describe("exercises/queries", () => {
  it("loads renderable exercise rows from indexed synced content rows", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const setId = await insertExerciseSet(ctx, 2);
      const firstQuestionId = await insertExerciseQuestion(ctx, setId, 1);
      const secondQuestionId = await insertExerciseQuestion(ctx, setId, 2);

      await insertExerciseChoice(ctx, firstQuestionId, 1);
      await insertExerciseChoice(ctx, firstQuestionId, 0);
      await insertExerciseChoice(ctx, secondQuestionId, 0);
    });

    const result = await queryRenderableRows(t);

    expect(result).toEqual([
      {
        choices: {
          id: [
            { label: "Choice 1", value: true },
            { label: "Choice 2", value: false },
          ],
          en: [],
        },
        number: 1,
      },
      {
        choices: {
          id: [{ label: "Choice 1", value: true }],
          en: [],
        },
        number: 2,
      },
    ]);
  });

  it("returns null when the synced exercise set does not exist", async () => {
    const t = convexTest(schema, convexModules);

    const result = await queryRenderableRows(t);

    expect(result).toBeNull();
  });

  it("fails when question rows do not match the declared count", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertExerciseSet(ctx, 2);
    });

    await expectIntegrityError(
      queryRenderableRows(t),
      "Exercise set question count does not match synced question rows."
    );
  });

  it("fails when question numbers are not contiguous", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const setId = await insertExerciseSet(ctx, 2);
      const firstQuestionId = await insertExerciseQuestion(ctx, setId, 1);
      const thirdQuestionId = await insertExerciseQuestion(ctx, setId, 3);

      await insertExerciseChoice(ctx, firstQuestionId, 0);
      await insertExerciseChoice(ctx, thirdQuestionId, 0);
    });

    await expectIntegrityError(
      queryRenderableRows(t),
      "Exercise set questions must use contiguous 1-based numbers."
    );
  });

  it("fails when a question has more choices than content sync allows", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const setId = await insertExerciseSet(ctx, 1);
      const questionId = await insertExerciseQuestion(ctx, setId, 1);

      for (
        let order = 0;
        order <= CONTENT_SYNC_BATCH_LIMITS.exerciseChoices;
        order++
      ) {
        await insertExerciseChoice(ctx, questionId, order);
      }
    });

    await expectIntegrityError(
      queryRenderableRows(t),
      "Exercise question has more synced choices than the content-sync choice limit."
    );
  });
});
