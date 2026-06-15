import { formatLearningProfilePromptContext } from "@repo/ai/prompt/learning-profile";
import type { AgentLearningProfile } from "@repo/ai/types/agents";
import { describe, expect, it } from "vitest";

const baseLearningProfile: AgentLearningProfile = {
  interests: ["exam-prep", "nakafa-path"],
  planItems: [],
  program: {
    coverageStatus: "partial",
    key: "snbt-2026",
    kind: "admission-exam",
    title: "SNBT 2026",
    versionLabel: "2026",
  },
};

describe("formatLearningProfilePromptContext", () => {
  it("formats absent and empty learning profile context", () => {
    expect(formatLearningProfilePromptContext(undefined)).toBe(
      "- active learning profile: not selected"
    );
    expect(formatLearningProfilePromptContext(baseLearningProfile)).toContain(
      "- first plan items: none yet"
    );
  });

  it("formats route-backed and graph-asset plan items without field names", () => {
    const promptContext = formatLearningProfilePromptContext({
      ...baseLearningProfile,
      planItems: [
        {
          content_id: "asset:id:exercise:snbt:2026:set-1",
          lensId: "lens:snbt",
          position: 1,
          route: "/exercises/high-school/snbt/2026/set-1",
          status: "ready",
          title: "SNBT Set 1",
        },
        {
          content_id: "asset:id:subject:mathematics:rational-function",
          lensId: "lens:math",
          position: 2,
          status: "skipped",
        },
      ],
      stage: "grade-12",
    });

    expect(promptContext).toContain("- stage: Grade 12");
    expect(promptContext).toContain(
      "1. SNBT Set 1; route: /exercises/high-school/snbt/2026/set-1; status: ready"
    );
    expect(promptContext).toContain(
      "2. Untitled graph item; graph asset reference: asset:id:subject:mathematics:rational-function; status: skipped"
    );
    expect(promptContext).not.toContain("content_id");
  });

  it("formats controlled stage values as fixed labels", () => {
    expect(
      formatLearningProfilePromptContext({
        ...baseLearningProfile,
        stage: "grade-10",
      })
    ).toContain("- stage: Grade 10");
    expect(
      formatLearningProfilePromptContext({
        ...baseLearningProfile,
        stage: "grade-11",
      })
    ).toContain("- stage: Grade 11");
  });
});
