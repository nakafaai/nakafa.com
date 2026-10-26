import { describe, expect, it } from "@effect/vitest";
import { readReview } from "@/components/player/review";

/** One question of a section, as the navigator marks it. */
function question(key: string, answered: boolean, flagged: boolean) {
  return { answered, flagged, key };
}

describe("player review", () => {
  it("lists every flagged question, then the unanswered ones without a flag, each once and in order", () => {
    const questions = [
      question("1", true, false),
      question("2", false, true),
      question("3", false, false),
      question("4", true, true),
      question("5", false, false),
    ];

    expect(readReview(questions)).toEqual({
      flagged: [questions[1], questions[3]],
      unanswered: [questions[2], questions[4]],
    });
  });

  it("has nothing to review once every question is answered and none is flagged", () => {
    expect(
      readReview([question("1", true, false), question("2", true, false)])
    ).toEqual({ flagged: [], unanswered: [] });
  });
});
