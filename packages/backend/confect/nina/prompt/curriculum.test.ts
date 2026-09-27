import { describe, expect, it } from "@effect/vitest";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import type { AgentCurriculumPreference } from "@repo/backend/confect/nina/contract/agent";
import { formatCurriculumPreferencePromptContext } from "@repo/backend/confect/nina/prompt/curriculum";

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
