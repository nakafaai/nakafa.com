import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { MAX_PROTECTED_RUNTIME_SELECTORS } from "@nakafa/aksara-contracts/runtime/protected/limits";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import {
  planTryoutContentBatches,
  restoreTryoutContentOrder,
  TryoutContentBatchOrderError,
} from "@/components/tryout/content/batch";
import { projectTryoutRuntimeContent } from "@/components/tryout/content/model";

describe("try-out signed content batches", () => {
  it.live("preserves question and answer order across the wire ceiling", () =>
    Effect.gen(function* () {
      const questions = Array.from(
        { length: MAX_PROTECTED_RUNTIME_SELECTORS - 1 },
        (_, index) => `question-${index + 1}`
      );
      const answers = ["answer-1", "answer-2", "answer-3"];
      const plan = planTryoutContentBatches(questions, answers);

      expect(plan.batches.map(({ length }) => length)).toEqual([
        MAX_PROTECTED_RUNTIME_SELECTORS,
        2,
      ]);
      const renderedBatches = plan.batches.map((batch) =>
        batch.map((entry) => `rendered:${entry}`)
      );

      expect(yield* restoreTryoutContentOrder(plan, renderedBatches)).toEqual({
        answers: answers.map((answer) => `rendered:${answer}`),
        questions: questions.map((question) => `rendered:${question}`),
      });
    })
  );

  it.live(
    "fails with a typed error when one rendered batch loses an item",
    () =>
      Effect.gen(function* () {
        const plan = planTryoutContentBatches(["question-1"], ["answer-1"]);

        expect(
          yield* restoreTryoutContentOrder(plan, [
            ["rendered:question-1"],
          ]).pipe(Effect.flip)
        ).toEqual(new TryoutContentBatchOrderError());
      })
  );

  it.live(
    "fails with a typed error when the rendered batch count changes",
    () =>
      Effect.gen(function* () {
        const questions = Array.from(
          { length: MAX_PROTECTED_RUNTIME_SELECTORS + 1 },
          (_, index) => `question-${index + 1}`
        );
        const plan = planTryoutContentBatches(questions, []);

        expect(
          yield* restoreTryoutContentOrder(plan, [questions.slice(0, -1)]).pipe(
            Effect.flip
          )
        ).toEqual(new TryoutContentBatchOrderError());
      })
  );

  it.live(
    "fails with a typed error when the plan count differs from its batches",
    () =>
      Effect.gen(function* () {
        const plan = {
          ...planTryoutContentBatches(["question-1"], []),
          selectorCount: 2,
        };

        expect(
          yield* restoreTryoutContentOrder(plan, [
            ["rendered:question-1"],
          ]).pipe(Effect.flip)
        ).toEqual(new TryoutContentBatchOrderError());
      })
  );

  it("projects restored partitions without changing their runtime order", () => {
    const entry = (name: string) => ({
      artifactHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
      body: name,
      contentHash: `${name}-hash`,
      sourcePath: `${name}-path`,
      sourceRevision: `${name}-revision`,
    });

    expect(
      projectTryoutRuntimeContent({
        answers: [entry("answer-1")],
        questions: [entry("question-1"), entry("question-2")],
      })
    ).toEqual({
      answers: [
        {
          answer: "answer-1",
          contentHash: "answer-1-hash",
          sourcePath: "answer-1-path",
          sourceRevision: "answer-1-revision",
        },
      ],
      questions: [
        {
          content: "question-1",
          contentHash: "question-1-hash",
          sourcePath: "question-1-path",
          sourceRevision: "question-1-revision",
        },
        {
          content: "question-2",
          contentHash: "question-2-hash",
          sourcePath: "question-2-path",
          sourceRevision: "question-2-revision",
        },
      ],
    });
  });
});
