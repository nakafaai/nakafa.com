import { describe, expect, it } from "@effect/vitest";
import { projectTryoutQuestions } from "@/components/tryout/player/model";
import {
  makeTryoutQuestion,
  makeTryoutRuntime,
  TRYOUT_NOW,
} from "@/test/tryout";

describe("try-out player questions", () => {
  it("projects order, answers, and flags with actions bound per question", () => {
    const answered = makeTryoutQuestion("b", {
      flagged: true,
      questionOrder: 2,
      response: {
        answeredAt: TRYOUT_NOW,
        isComplete: true,
        selection: { kind: "single-choice", optionKey: "option-1" },
        updatedAt: TRYOUT_NOW,
      },
    });
    const empty = makeTryoutQuestion("a");
    const answer = vi.fn();
    const flag = vi.fn();
    const [first, second] = projectTryoutQuestions({
      answer,
      flag,
      runtime: makeTryoutRuntime([empty, answered]),
    });
    expect(first).toMatchObject({
      answered: false,
      flagged: false,
      key: "a",
      number: 1,
      selection: null,
    });
    expect(second).toMatchObject({
      answered: true,
      flagged: true,
      key: "b",
      number: 2,
      responseSpec: answered.responseSpec,
      selection: { kind: "single-choice", optionKey: "option-1" },
    });
    second?.answer(null);
    first?.flag(true);
    expect(answer).toHaveBeenCalledWith(answered, null);
    expect(flag).toHaveBeenCalledWith(empty, true);
  });
});
