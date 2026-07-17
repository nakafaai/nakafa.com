import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { QuestionChoicesSchema } from "./choices";

const correctChoice = { label: "Correct", value: true };
const incorrectChoice = { label: "Incorrect", value: false };
const decodeChoices = Schema.decodeUnknownEither(QuestionChoicesSchema);
const decodeChoicesSync = Schema.decodeUnknownSync(QuestionChoicesSchema);

describe("QuestionChoicesSchema", () => {
  it("accepts exactly one correct choice per locale", () => {
    const result = decodeChoices({
      en: [correctChoice, incorrectChoice],
      id: [incorrectChoice, correctChoice],
    });

    expect(result._tag).toBe("Right");
  });

  it.each([
    {
      choices: [incorrectChoice, incorrectChoice],
      name: "zero correct choices",
    },
    {
      choices: [correctChoice, correctChoice],
      name: "multiple correct choices",
    },
  ])("rejects $name", ({ choices }) => {
    const result = decodeChoices({
      en: choices,
      id: [correctChoice, incorrectChoice],
    });

    expect(result._tag).toBe("Left");
  });

  it("validates every locale independently", () => {
    const result = decodeChoices({
      en: [correctChoice, incorrectChoice],
      id: [],
    });

    expect(result._tag).toBe("Left");
  });

  it("requires every supported locale", () => {
    const result = decodeChoices({
      en: [correctChoice, incorrectChoice],
    });

    expect(result._tag).toBe("Left");
  });

  it("reports the single-correct-choice invariant", () => {
    expect(() =>
      decodeChoicesSync({
        en: [incorrectChoice, incorrectChoice],
        id: [correctChoice, incorrectChoice],
      })
    ).toThrow("Expected exactly one correct choice.");
  });
});
