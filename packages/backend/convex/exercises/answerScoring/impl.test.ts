import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { scoreExerciseAnswer } from "@repo/backend/convex/exercises/answerScoring/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 11, 0, 0);

/** Inserts one user for answer-scoring attempt fixtures. */
async function insertUser(ctx: MutationCtx, suffix: string) {
  return await ctx.db.insert("users", {
    authId: `auth-${suffix}`,
    credits: 0,
    creditsResetAt: NOW,
    email: `${suffix}@example.com`,
    name: `User ${suffix}`,
    plan: "free",
  });
}

/** Inserts one exercise set and question for answer-scoring fixtures. */
async function insertQuestion(ctx: MutationCtx, suffix: string, number = 1) {
  const slug = `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${suffix}`;
  const setId = await ctx.db.insert("exerciseSets", {
    category: "high-school",
    exerciseType: "try-out",
    locale: "id",
    material: "quantitative-knowledge",
    questionCount: 2,
    setName: suffix,
    slug,
    syncedAt: NOW,
    title: `Set ${suffix}`,
    type: "snbt",
  });
  const questionId = await ctx.db.insert("exerciseQuestions", {
    answerBody: "Answer body",
    category: "high-school",
    contentHash: `hash-${suffix}-${number}`,
    date: NOW,
    exerciseType: "try-out",
    locale: "id",
    material: "quantitative-knowledge",
    number,
    questionBody: "Question body",
    setId,
    setName: suffix,
    slug: `${slug}/${number}`,
    syncedAt: NOW,
    title: `Question ${number}`,
    type: "snbt",
  });

  return { questionId, setId, slug };
}

/** Inserts two canonical choices for a question. */
async function insertChoices(
  ctx: MutationCtx,
  questionId: Id<"exerciseQuestions">
) {
  await ctx.db.insert("exerciseChoices", {
    isCorrect: false,
    label: "Choice A",
    locale: "id",
    optionKey: "A",
    order: 0,
    questionId,
  });
  await ctx.db.insert("exerciseChoices", {
    isCorrect: true,
    label: "Choice B",
    locale: "id",
    optionKey: "B",
    order: 1,
    questionId,
  });
}

/** Inserts an in-progress exercise attempt for scoring fixtures. */
async function insertAttempt(
  ctx: MutationCtx,
  {
    exerciseNumber,
    scope = "set",
    slug,
  }: {
    exerciseNumber?: number;
    scope?: "set" | "single";
    slug: string;
  }
) {
  const userId = await insertUser(
    ctx,
    `answer-scoring-${slug.split("/").at(-1)}`
  );
  const attemptId = await ctx.db.insert("exerciseAttempts", {
    answeredCount: 0,
    completedAt: null,
    correctAnswers: 0,
    endReason: null,
    exerciseNumber,
    lastActivityAt: NOW,
    mode: "practice",
    origin: "standalone",
    scope,
    scorePercentage: 0,
    slug,
    startedAt: NOW,
    status: "in-progress",
    timeLimit: 3600,
    totalExercises: scope === "single" ? 1 : 2,
    totalTime: 0,
    updatedAt: NOW,
    userId,
  });
  const attempt = await ctx.db.get("exerciseAttempts", attemptId);

  if (!attempt) {
    throw new Error("Expected answer-scoring attempt to exist.");
  }

  return attempt;
}

/** Expects a ConvexError-like object with the supplied domain code. */
async function expectConvexCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({
    data: {
      code,
    },
  });
}

describe("exercises/answerScoring/impl", () => {
  it("derives canonical answer text and correctness from stored choices", async () => {
    const t = convexTest(schema, convexModules);
    const scoredAnswer = await t.mutation(async (ctx) => {
      const question = await insertQuestion(ctx, "canonical-answer");
      await insertChoices(ctx, question.questionId);
      const attempt = await insertAttempt(ctx, { slug: question.slug });

      return await runConvexProgram(
        scoreExerciseAnswer(ctx.db, {
          attempt,
          exerciseNumber: 1,
          questionId: question.questionId,
          selectedOptionId: "B",
        })
      );
    });

    expect(scoredAnswer).toEqual({
      isCorrect: true,
      questionId: expect.any(String),
      selectedOptionId: "B",
      textAnswer: "Choice B",
    });
  });

  it("rejects answers for deleted questions", async () => {
    const t = convexTest(schema, convexModules);

    await expectConvexCode(
      t.mutation(async (ctx) => {
        const question = await insertQuestion(ctx, "deleted-question");
        await insertChoices(ctx, question.questionId);
        const attempt = await insertAttempt(ctx, { slug: question.slug });
        await ctx.db.delete("exerciseQuestions", question.questionId);

        return await runConvexProgram(
          scoreExerciseAnswer(ctx.db, {
            attempt,
            exerciseNumber: 1,
            questionId: question.questionId,
            selectedOptionId: "B",
          })
        );
      }),
      "QUESTION_NOT_FOUND"
    );
  });

  it("rejects questions from another exercise set", async () => {
    const t = convexTest(schema, convexModules);

    await expectConvexCode(
      t.mutation(async (ctx) => {
        const expectedQuestion = await insertQuestion(ctx, "expected-set");
        const otherQuestion = await insertQuestion(ctx, "other-set");
        await insertChoices(ctx, otherQuestion.questionId);
        const attempt = await insertAttempt(ctx, {
          slug: expectedQuestion.slug,
        });

        return await runConvexProgram(
          scoreExerciseAnswer(ctx.db, {
            attempt,
            exerciseNumber: 1,
            questionId: otherQuestion.questionId,
            selectedOptionId: "B",
          })
        );
      }),
      "INVALID_QUESTION"
    );
  });

  it("rejects questions whose stored number does not match the answer", async () => {
    const t = convexTest(schema, convexModules);

    await expectConvexCode(
      t.mutation(async (ctx) => {
        const question = await insertQuestion(ctx, "number-mismatch", 2);
        await insertChoices(ctx, question.questionId);
        const attempt = await insertAttempt(ctx, { slug: question.slug });

        return await runConvexProgram(
          scoreExerciseAnswer(ctx.db, {
            attempt,
            exerciseNumber: 1,
            questionId: question.questionId,
            selectedOptionId: "B",
          })
        );
      }),
      "INVALID_ARGUMENT"
    );
  });

  it("rejects a different exercise number for single-scope attempts", async () => {
    const t = convexTest(schema, convexModules);

    await expectConvexCode(
      t.mutation(async (ctx) => {
        const question = await insertQuestion(ctx, "single-scope", 2);
        await insertChoices(ctx, question.questionId);
        const attempt = await insertAttempt(ctx, {
          exerciseNumber: 1,
          scope: "single",
          slug: question.slug,
        });

        return await runConvexProgram(
          scoreExerciseAnswer(ctx.db, {
            attempt,
            exerciseNumber: 2,
            questionId: question.questionId,
            selectedOptionId: "B",
          })
        );
      }),
      "INVALID_ARGUMENT"
    );
  });

  it("rejects selected options that do not belong to the question", async () => {
    const t = convexTest(schema, convexModules);

    await expectConvexCode(
      t.mutation(async (ctx) => {
        const question = await insertQuestion(ctx, "invalid-option");
        await insertChoices(ctx, question.questionId);
        const attempt = await insertAttempt(ctx, { slug: question.slug });

        return await runConvexProgram(
          scoreExerciseAnswer(ctx.db, {
            attempt,
            exerciseNumber: 1,
            questionId: question.questionId,
            selectedOptionId: "Z",
          })
        );
      }),
      "INVALID_ARGUMENT"
    );
  });
});
