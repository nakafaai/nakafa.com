import type { ModelMessage } from "ai";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { prepareChatStep } from "@/app/api/chat/step";

const emptyMessages = [] satisfies ModelMessage[];
const externalUrlMessages = [
  {
    content:
      "Baca halaman https://ai-sdk.dev/docs/ai-sdk-core/devtools dan jelaskan peringatannya.",
    role: "user",
  },
] satisfies ModelMessage[];

describe("app/api/chat/step", () => {
  it("forces Nakafa on the first page-fetch step", () => {
    const step = Effect.runSync(
      prepareChatStep({
        messages: emptyMessages,
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
        messages: emptyMessages,
        needsPageFetch: true,
        stepNumber: 1,
      })
    );

    expect(step).toBeUndefined();
  });

  it("keeps normal tool choice on the first non-page-fetch step", () => {
    const step = Effect.runSync(
      prepareChatStep({
        messages: emptyMessages,
        needsPageFetch: false,
        stepNumber: 0,
      })
    );

    expect(step).toBeUndefined();
  });

  it("keeps normal tool choice after the first non-page-fetch step", () => {
    const step = Effect.runSync(
      prepareChatStep({
        messages: emptyMessages,
        needsPageFetch: false,
        stepNumber: 1,
      })
    );

    expect(step).toBeUndefined();
  });

  it("forces research for first-step external URL requests", () => {
    const step = Effect.runSync(
      prepareChatStep({
        messages: externalUrlMessages,
        needsPageFetch: false,
        stepNumber: 0,
      })
    );

    expect(step).toEqual({
      activeTools: ["deepResearch"],
      toolChoice: { type: "tool", toolName: "deepResearch" },
    });
  });

  it("keeps page fetch ahead of external URL requests", () => {
    const step = Effect.runSync(
      prepareChatStep({
        messages: externalUrlMessages,
        needsPageFetch: true,
        stepNumber: 0,
      })
    );

    expect(step).toEqual({
      activeTools: ["nakafa"],
      toolChoice: { type: "tool", toolName: "nakafa" },
    });
  });
});
