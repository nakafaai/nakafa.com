import { preparePageFetchStep } from "@repo/ai/agents/content/step";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("content/step", () => {
  it("forces the existing getContent tool on the first page-fetch step", () => {
    const step = Effect.runSync(
      preparePageFetchStep({
        needsPageFetch: true,
        stepNumber: 0,
      })
    );

    expect(step).toEqual({
      activeTools: ["getContent"],
      toolChoice: { type: "tool", toolName: "getContent" },
    });
  });

  it("keeps normal tool choice after the first page-fetch step", () => {
    const step = Effect.runSync(
      preparePageFetchStep({
        needsPageFetch: true,
        stepNumber: 1,
      })
    );

    expect(step).toBeUndefined();
  });

  it("keeps normal tool choice when no page fetch is needed", () => {
    const step = Effect.runSync(
      preparePageFetchStep({
        needsPageFetch: false,
        stepNumber: 0,
      })
    );

    expect(step).toBeUndefined();
  });
});
