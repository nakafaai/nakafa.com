import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { prepareNakafaStep } from "@/app/api/chat/step";

describe("app/api/chat/step", () => {
  it("forces Nakafa on the first page-fetch step", () => {
    const step = Effect.runSync(
      prepareNakafaStep({
        needsPageFetch: true,
        stepNumber: 0,
      })
    );

    expect(step).toEqual({
      activeTools: ["nakafa"],
      toolChoice: { type: "tool", toolName: "nakafa" },
    });
  });

  it("keeps normal tool choice after the first page-fetch step", () => {
    const step = Effect.runSync(
      prepareNakafaStep({
        needsPageFetch: true,
        stepNumber: 1,
      })
    );

    expect(step).toBeUndefined();
  });

  it("keeps normal tool choice when no page fetch is needed", () => {
    const step = Effect.runSync(
      prepareNakafaStep({
        needsPageFetch: false,
        stepNumber: 0,
      })
    );

    expect(step).toBeUndefined();
  });
});
