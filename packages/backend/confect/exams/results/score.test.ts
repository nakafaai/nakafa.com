import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { newChoiceAnswers } from "@repo/backend/confect/exams/question";
import {
  pointsOf,
  scoreResponse,
} from "@repo/backend/confect/exams/results/score";
import { Array as Arr } from "effect";

/** A single-answer choice with four options, as a new question starts. */
const single: Interaction[] = [...newChoiceAnswers()];

/** The same choice taking up to two options, as a multiple-choice question. */
const multiple: Interaction[] = Arr.map(single, (interaction) =>
  interaction.kind === "choice"
    ? { ...interaction, maxChoices: 2 }
    : interaction
);

/** A text answer, which a person judges. */
const text: Interaction = { id: "text", kind: "textEntry", label: "Answer" };

/** The key of the choice `choice`, with the given options correct. A key names at least one correct option. */
const keyOf = (
  correct: readonly [string, ...string[]],
  interaction = "choice"
): InteractionKey[] => [{ correct, interaction, kind: "choice" }];

describe("exams/results/score", () => {
  it("scores a single-answer choice correct when its one option is the correct option", () => {
    expect(scoreResponse(single, keyOf(["option-2"]), ["option-2"])).toBe(
      "correct"
    );
  });

  it("scores a single-answer choice incorrect when it chooses another option", () => {
    expect(scoreResponse(single, keyOf(["option-2"]), ["option-1"])).toBe(
      "incorrect"
    );
  });

  it("scores an unanswered question incorrect, as the sitting closes it", () => {
    expect(scoreResponse(single, keyOf(["option-2"]), [])).toBe("incorrect");
  });

  it("scores a multiple-choice question correct when its selection is exactly the correct options, in any order", () => {
    expect(
      scoreResponse(multiple, keyOf(["option-1", "option-3"]), [
        "option-3",
        "option-1",
      ])
    ).toBe("correct");
  });

  it("scores a multiple-choice selection that misses a correct option or adds a wrong one incorrect", () => {
    const key = keyOf(["option-1", "option-3"]);
    expect(scoreResponse(multiple, key, ["option-1"])).toBe("incorrect");
    expect(
      scoreResponse(multiple, key, ["option-1", "option-3", "option-4"])
    ).toBe("incorrect");
  });

  it("scores a repeated option incorrect, even when it repeats a correct one", () => {
    expect(
      scoreResponse(multiple, keyOf(["option-1", "option-3"]), [
        "option-1",
        "option-1",
      ])
    ).toBe("incorrect");
  });

  it("leaves a question pending when it has no key yet", () => {
    expect(scoreResponse(single, null, ["option-2"])).toBe("pending");
  });

  it("leaves a question pending when its key holds no choice answer for its choice", () => {
    expect(
      scoreResponse(single, keyOf(["option-2"], "another-choice"), ["option-2"])
    ).toBe("pending");
  });

  it("leaves a text answer pending, since a person judges it", () => {
    expect(scoreResponse([text], keyOf(["option-2"]), ["option-2"])).toBe(
      "pending"
    );
  });

  it("leaves a question of two interactions pending, since a student answers one choice", () => {
    expect(
      scoreResponse([...single, text], keyOf(["option-2"]), ["option-2"])
    ).toBe("pending");
  });

  it("scores a single-answer choice that names two options incorrect, as it names no one option", () => {
    expect(
      scoreResponse(single, keyOf(["option-2"]), ["option-2", "option-3"])
    ).toBe("incorrect");
  });

  it("scores an unanswered multiple-choice question incorrect, as the sitting closes it", () => {
    expect(scoreResponse(multiple, keyOf(["option-1", "option-3"]), [])).toBe(
      "incorrect"
    );
  });

  it("earns one point for a correct answer and none for any other verdict", () => {
    expect(pointsOf("correct")).toBe(1);
    expect(pointsOf("incorrect")).toBe(0);
    expect(pointsOf("pending")).toBe(0);
  });
});
