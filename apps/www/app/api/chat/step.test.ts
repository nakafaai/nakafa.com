import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { prepareChatStep } from "@/app/api/chat/step";

describe("app/api/chat/step", () => {
  it("forces Nakafa on the first page-fetch step", () => {
    const step = Effect.runSync(
      prepareChatStep({
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
      prepareChatStep({
        needsPageFetch: true,
        stepNumber: 1,
      })
    );

    expect(step).toBeUndefined();
  });

  it("requires a specialist tool on the first non-page-fetch step", () => {
    const step = Effect.runSync(
      prepareChatStep({
        needsPageFetch: false,
        stepNumber: 0,
      })
    );

    expect(step).toEqual({
      toolChoice: "required",
    });
  });

  it("keeps normal tool choice after the first non-page-fetch step", () => {
    const step = Effect.runSync(
      prepareChatStep({
        needsPageFetch: false,
        stepNumber: 1,
      })
    );

    expect(step).toBeUndefined();
  });
});
