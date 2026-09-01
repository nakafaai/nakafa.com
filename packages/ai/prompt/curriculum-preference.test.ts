import { describe, expect, it } from "@effect/vitest";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { formatCurriculumPreferencePromptContext } from "@repo/ai/prompt/curriculum-preference";
import type { AgentCurriculumPreference } from "@repo/ai/types/agents";

const preference: AgentCurriculumPreference = {
  program: {
    key: LearningProgramKeySchema.make("cambridge-international"),
    title: "Cambridge International",
  },
};

describe("formatCurriculumPreferencePromptContext", () => {
  it("formats absent and selected curriculum context", () => {
    expect(formatCurriculumPreferencePromptContext(undefined)).toBe(
      "- curriculum preference: not selected"
    );
    expect(formatCurriculumPreferencePromptContext(preference)).toBe(
      [
        "- curriculum preference: selected",
        "- curriculum: Cambridge International",
        "- curriculum key: cambridge-international",
      ].join("\n")
    );
  });
});
