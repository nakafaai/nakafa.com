import { describe, expect, it } from "@effect/vitest";
import { REASON_ID } from "@repo/backend/confect/exams/scoring";
import { choiceTitle } from "@/components/tenant/exams/reason";

describe("the name of a choice", () => {
  it("names the answer and the reason of a question that asks for both", () => {
    expect(choiceTitle("reason", REASON_ID)).toBe("choice-title.reason");
    expect(choiceTitle("reason", "answer")).toBe("choice-title.answer");
  });

  it("leaves a question of one choice unnamed", () => {
    expect(choiceTitle("choice", REASON_ID)).toBeNull();
  });
});
