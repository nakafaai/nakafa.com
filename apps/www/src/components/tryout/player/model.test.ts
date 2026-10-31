import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { projectTryoutQuestions } from "@/components/tryout/player/model";
import { makeTryoutBody, makeTryoutQuestion } from "@/test/tryout";

/** A response the server stored for a question. */
const stored = (response: readonly string[]) => ({
  answeredAt: 1000,
  response,
  updatedAt: 1000,
});

describe("projectTryoutQuestions", () => {
  it("keeps the order and marks the questions the server counts as answered", () => {
    const projected = projectTryoutQuestions({
      answer: vi.fn(),
      bodies: [],
      flag: vi.fn(),
      questions: [
        makeTryoutQuestion("a"),
        makeTryoutQuestion("b", { response: stored(["first"]) }),
        makeTryoutQuestion("c", { response: stored([]) }),
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

  it("picks the option at a number's place of the question's own choice through the save its fields use", () => {
    const answer = vi.fn();
    const first = makeTryoutQuestion("a");
    const second = makeTryoutQuestion("b");
    const [withoutBody, projected] = projectTryoutQuestions({
      answer,
      bodies: [makeTryoutBody("b")],
      flag: vi.fn(),
      questions: [first, second],
    });

    expect(projected?.pick(1)).toBe(true);
    expect(projected?.pick(9)).toBe(false);
    // A question whose body has not arrived has no options to pick from.
    expect(withoutBody?.pick(0)).toBe(false);

    expect(answer.mock.calls).toEqual([[second, ["second"]]]);
  });

  it("marks the flagged questions and turns a question's flag the other way through the flag save", () => {
    const flag = vi.fn();
    const plain = makeTryoutQuestion("a");
    const flagged = makeTryoutQuestion("b", { flagged: true });
    const projected = projectTryoutQuestions({
      answer: vi.fn(),
      bodies: [],
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
