import {
  LearningArtifactDisplayCopy,
  MAX_LEARNING_ARTIFACT_DESCRIPTION_LENGTH,
  MAX_LEARNING_ARTIFACT_TITLE_LENGTH,
} from "@repo/math/schema/artifact/copy";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("LearningArtifactDisplayCopy", () => {
  it("accepts bounded LLM-authored copy with inline math markup", () => {
    expect(
      Schema.decodeUnknownSync(LearningArtifactDisplayCopy)({
        description:
          "Use $$m = \\frac{y_2-y_1}{x_2-x_1}$$ to connect both plotted points.",
        title: "Slope line through $$P_1$$ and $$P_2$$",
      })
    ).toMatchObject({
      title: "Slope line through $$P_1$$ and $$P_2$$",
    });
  });

  it("rejects blank and over-budget artifact copy before persistence", () => {
    for (const copy of [
      { description: "Readable.", title: "   " },
      { description: "   ", title: "Readable" },
      {
        description: "Readable.",
        title: "x".repeat(MAX_LEARNING_ARTIFACT_TITLE_LENGTH + 1),
      },
      {
        description: "x".repeat(MAX_LEARNING_ARTIFACT_DESCRIPTION_LENGTH + 1),
        title: "Readable",
      },
    ]) {
      expect(() =>
        Schema.decodeUnknownSync(LearningArtifactDisplayCopy)(copy)
      ).toThrow();
    }
  });
});
