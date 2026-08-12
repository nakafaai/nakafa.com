import { formatLearningSelectionPromptContext } from "@repo/ai/prompt/learning-selection";
import type { AgentLearningSelection } from "@repo/ai/types/agents";
import { LearningProgramKeySchema } from "@repo/contents/_types/program/schema";
import { describe, expect, it } from "vitest";

const selection: AgentLearningSelection = {
  interest: "exam-prep",
  program: {
    coverageStatus: "partial",
    key: LearningProgramKeySchema.make("snbt"),
    kind: "admission-exam",
    title: "SNBT 2026",
    versionLabel: "2026",
  },
};

describe("formatLearningSelectionPromptContext", () => {
  it("formats absent and selected learning context", () => {
    expect(formatLearningSelectionPromptContext(undefined)).toBe(
      "- active learning selection: not selected"
    );
    expect(formatLearningSelectionPromptContext(selection)).toBe(
      [
        "- active learning selection: selected",
        "- interest: exam-prep",
        "- program: SNBT 2026",
        "- program key: snbt",
        "- program kind: admission-exam",
        "- program version: 2026",
        "- coverage: partial",
      ].join("\n")
    );
  });
});
