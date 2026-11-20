import { describe, expect, it } from "@effect/vitest";
import { agentSentence } from "@repo/design-system/lib/confirm";
import { createElement } from "react";

const FALLBACK = "Ask the reader first.";

describe("agentSentence", () => {
  it("tells the agent the dialog's own sentence", () => {
    expect(
      agentSentence("Deletes the class for every student.", "Delete?", FALLBACK)
    ).toBe("Deletes the class for every student.");
  });

  it("tells the agent the title when the sentence is drawn with more than words", () => {
    expect(
      agentSentence(
        createElement("strong", null, "Every"),
        "Delete the class?",
        FALLBACK
      )
    ).toBe("Delete the class?");
  });

  it("still marks the action when neither is plain words", () => {
    expect(
      agentSentence(
        createElement("strong", null, "Every"),
        createElement("em", null, "Delete"),
        FALLBACK
      )
    ).toBe(FALLBACK);
  });
});
