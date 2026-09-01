import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { projectTryoutReview } from "@/components/tryout/review/model";

const FIRST_IDENTITY = {
  contentHash: "content-1",
  sourcePath: "questions/1",
  sourceRevision: "revision-1",
};
const SECOND_IDENTITY = {
  contentHash: "content-2",
  sourcePath: "questions/2",
  sourceRevision: "revision-2",
};

describe("projectTryoutReview", () => {
  it.effect("pairs signed questions and answers in frozen runtime order", () =>
    Effect.gen(function* () {
      const content = createContent([SECOND_IDENTITY, FIRST_IDENTITY]);
      const questions = [
        createRuntimeQuestion(FIRST_IDENTITY, 1),
        createRuntimeQuestion(SECOND_IDENTITY, 2),
      ];

      expect(yield* projectTryoutReview({ content, questions })).toEqual([
        {
          answer: "answer:questions/1",
          content: "question:questions/1",
          questionOrder: 1,
          response: {
            answeredAt: 10,
            isComplete: true,
            selection: { kind: "single-choice", optionKey: "option-1" },
            updatedAt: 10,
          },
          responseSpec: responseSpec(),
        },
        {
          answer: "answer:questions/2",
          content: "question:questions/2",
          questionOrder: 2,
          response: {
            answeredAt: 20,
            isComplete: true,
            selection: { kind: "single-choice", optionKey: "option-1" },
            updatedAt: 20,
          },
          responseSpec: responseSpec(),
        },
      ]);
    })
  );

  it.effect("fails with a typed error when one signed answer is missing", () =>
    Effect.gen(function* () {
      const content = createContent([FIRST_IDENTITY]);
      const incompleteContent = {
        ...content,
        answers: [],
      } satisfies TryoutRuntimeContent;

      expect(
        yield* Effect.flip(
          projectTryoutReview({
            content: incompleteContent,
            questions: [createRuntimeQuestion(FIRST_IDENTITY, 1)],
          })
        )
      ).toMatchObject({
        _tag: "TryoutReviewProjectionError",
        code: "TRYOUT_REVIEW_PROJECTION",
      });
    })
  );

  it.effect(
    "fails with a typed error when one signed question is missing",
    () =>
      expectProjectionError({
        content: createContent([]),
        questions: [createRuntimeQuestion(FIRST_IDENTITY, 1)],
      })
  );

  it.effect("fails with a typed error for duplicate content identity", () =>
    Effect.gen(function* () {
      const content = createContent([FIRST_IDENTITY, FIRST_IDENTITY]);

      expect(
        yield* Effect.flip(
          projectTryoutReview({
            content,
            questions: [
              createRuntimeQuestion(FIRST_IDENTITY, 1),
              createRuntimeQuestion(SECOND_IDENTITY, 2),
            ],
          })
        )
      ).toMatchObject({
        _tag: "TryoutReviewProjectionError",
        code: "TRYOUT_REVIEW_PROJECTION",
      });
    })
  );

  it.effect("fails with a typed error for duplicate answer identity", () =>
    Effect.gen(function* () {
      const content = createContent([FIRST_IDENTITY, SECOND_IDENTITY]);

      yield* expectProjectionError({
        content: {
          ...content,
          answers: [content.answers[0], content.answers[0]],
        },
        questions: [
          createRuntimeQuestion(FIRST_IDENTITY, 1),
          createRuntimeQuestion(SECOND_IDENTITY, 2),
        ],
      });
    })
  );

  it.effect("fails with a typed error for duplicate runtime order", () =>
    expectProjectionError({
      content: createContent([FIRST_IDENTITY, SECOND_IDENTITY]),
      questions: [
        createRuntimeQuestion(FIRST_IDENTITY, 1),
        createRuntimeQuestion(SECOND_IDENTITY, 1),
      ],
    })
  );

  it.effect(
    "fails with a typed error for runtime and signed identity drift",
    () =>
      expectProjectionError({
        content: createContent([FIRST_IDENTITY]),
        questions: [createRuntimeQuestion(SECOND_IDENTITY, 1)],
      })
  );

  it.effect("fails with a typed error for empty signed answer content", () =>
    Effect.gen(function* () {
      const content = createContent([FIRST_IDENTITY]);

      yield* expectProjectionError({
        content: {
          ...content,
          answers: [{ ...content.answers[0], answer: null }],
        },
        questions: [createRuntimeQuestion(FIRST_IDENTITY, 1)],
      });
    })
  );
});

/** Expects the review projection to fail through its typed Effect channel. */
function expectProjectionError(
  input: Parameters<typeof projectTryoutReview>[0]
) {
  return Effect.gen(function* () {
    expect(yield* Effect.flip(projectTryoutReview(input))).toMatchObject({
      _tag: "TryoutReviewProjectionError",
      code: "TRYOUT_REVIEW_PROJECTION",
    });
  });
}

/** Creates rendered signed content in an explicit storage order. */
function createContent(
  identities: readonly (typeof FIRST_IDENTITY)[]
): TryoutRuntimeContent {
  return {
    answers: identities.map((identity) => ({
      answer: `answer:${identity.sourcePath}`,
      ...identity,
    })),
    questions: identities.map((identity) => ({
      content: `question:${identity.sourcePath}`,
      ...identity,
    })),
  };
}

/** Creates one frozen runtime question without unrelated attempt fields. */
function createRuntimeQuestion(
  identity: typeof FIRST_IDENTITY,
  questionOrder: number
) {
  return {
    ...identity,
    questionOrder,
    response: {
      answeredAt: questionOrder * 10,
      isComplete: true,
      selection: { kind: "single-choice" as const, optionKey: "option-1" },
      updatedAt: questionOrder * 10,
    },
    responseSpec: responseSpec(),
  };
}

function responseSpec() {
  return {
    kind: "single-choice" as const,
    options: [
      {
        isCorrect: true,
        label: "A",
        optionKey: "option-1",
        order: 1,
      },
    ],
  };
}
