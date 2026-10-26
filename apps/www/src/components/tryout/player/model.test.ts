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
      flag: vi.fn(),
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

  it("picks an option of a question through the save that its response fields use", () => {
    const answer = vi.fn();
    const first = makeTryoutQuestion("a");
    const second = makeTryoutQuestion("b");
    const [, projected] = projectTryoutQuestions({
      answer,
      flag: vi.fn(),
      questions: [first, second],
    });

    expect(projected?.pick(1)).toBe(true);
    expect(projected?.pick(9)).toBe(false);

    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer).toHaveBeenCalledWith(second, {
      kind: "single-choice",
      optionKey: "second",
    });
  });

  it("marks the flagged questions and turns a question's flag the other way through the flag save", () => {
    const flag = vi.fn();
    const plain = makeTryoutQuestion("a");
    const flagged = makeTryoutQuestion("b", { flagged: true });
    const projected = projectTryoutQuestions({
      answer: vi.fn(),
      flag,
      questions: [plain, flagged],
    });

    expect(Arr.map(projected, (question) => question.flagged)).toEqual([
      false,
      true,
    ]);
    projected[0]?.flag();
    projected[1]?.flag();
    expect(flag.mock.calls).toEqual([
      [plain, true],
      [flagged, false],
    ]);
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
