import { describe, expect, it } from "@effect/vitest";
import { prepareResearchEvidenceStep } from "@repo/backend/confect/nina/research/step";

describe("research agent step state", () => {
  it("forces one inspectable web search before the evidence notes", () => {
    expect(
      prepareResearchEvidenceStep({
        hasWebSearchToolCall: false,
      })
    ).toEqual({
      activeTools: ["webSearch"],
      toolChoice: { toolName: "webSearch", type: "tool" },
    });
  });

  it("offers no tools once the search has run", () => {
    expect(
      prepareResearchEvidenceStep({
        hasWebSearchToolCall: true,
      })
    ).toEqual({ activeTools: [] });
  });
});
