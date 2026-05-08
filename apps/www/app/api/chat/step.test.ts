import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { prepareContentStep } from "@/app/api/chat/step";

describe("app/api/chat/step", () => {
  it("forces contentAccess on the first page-fetch step", () => {
    const step = Effect.runSync(
      prepareContentStep({
        needsPageFetch: true,
        stepNumber: 0,
      })
    );

    expect(step).toEqual({
      activeTools: ["contentAccess"],
      toolChoice: { type: "tool", toolName: "contentAccess" },
    });
  });

  it("keeps normal tool choice after the first page-fetch step", () => {
    const step = Effect.runSync(
      prepareContentStep({
        needsPageFetch: true,
        stepNumber: 1,
      })
    );

    expect(step).toBeUndefined();
  });

  it("keeps normal tool choice when no page fetch is needed", () => {
    const step = Effect.runSync(
      prepareContentStep({
        needsPageFetch: false,
        stepNumber: 0,
      })
    );

    expect(step).toBeUndefined();
  });
});
