import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  joinTryoutBodies,
  projectTryoutQuestions,
} from "@/components/tryout/player/model";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";
import { makeTryoutQuestion } from "@/test/tryout";

const complete: NonNullable<TryoutRuntimeQuestion["response"]> = {
  answeredAt: 1000,
  isComplete: true,
  selection: { kind: "single-choice", optionKey: "first" },
  updatedAt: 1000,
};

describe("projectTryoutQuestions", () => {
  it("keeps the order and marks the questions that have a complete answer", () => {
    const projected = projectTryoutQuestions({
      answer: vi.fn(),
      questions: [
        makeTryoutQuestion("a"),
        makeTryoutQuestion("b", { response: complete }),
        makeTryoutQuestion("c", {
          response: { ...complete, isComplete: false },
        }),
      ],
    });

    expect(Arr.map(projected, (question) => question.key)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(Arr.map(projected, (question) => question.answered)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("answers a question through the save that its response fields use", () => {
    const answer = vi.fn();
    const first = makeTryoutQuestion("a");
    const second = makeTryoutQuestion("b");
    const [, projected] = projectTryoutQuestions({
      answer,
      questions: [first, second],
    });

    projected?.answer({ kind: "single-choice", optionKey: "second" });
    projected?.answer(null);

    expect(answer).toHaveBeenNthCalledWith(1, second, {
      kind: "single-choice",
      optionKey: "second",
    });
    expect(answer).toHaveBeenNthCalledWith(2, second, null);
    expect(projected?.responseSpec).toBe(second.responseSpec);
  });
});

/** The signed body of one question, as the identity frozen at attempt start names it. */
function bodyOf(question: TryoutRuntimeQuestion, content: string) {
  return {
    content,
    contentHash: question.contentHash,
    sourcePath: question.sourcePath,
    sourceRevision: question.sourceRevision,
  };
}

describe("joinTryoutBodies", () => {
  const first = makeTryoutQuestion("a");
  const second = makeTryoutQuestion("b");

  it("pairs each question with its own body, in the order of the questions", () => {
    const joined = joinTryoutBodies({
      bodies: [bodyOf(second, "second body"), bodyOf(first, "first body")],
      questions: [first, second],
    });

    expect(joined).toEqual(
      Option.some([
        { body: "first body", question: first },
        { body: "second body", question: second },
      ])
    );
  });

  it("tells a revision of the same file apart", () => {
    const revised = makeTryoutQuestion("a", { sourceRevision: "newer" });

    expect(
      joinTryoutBodies({
        bodies: [bodyOf(first, "first body")],
        questions: [revised],
      })
    ).toEqual(Option.none());
  });

  it("finds nothing when any question has no body", () => {
    expect(
      joinTryoutBodies({
        bodies: [bodyOf(first, "first body")],
        questions: [first, second],
      })
    ).toEqual(Option.none());
  });
});
