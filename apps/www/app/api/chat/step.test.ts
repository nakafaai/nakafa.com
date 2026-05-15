import type { ModelMessage } from "ai";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { prepareChatStep } from "@/app/api/chat/step";

const emptyMessages = [] satisfies ModelMessage[];
const system = "Base system prompt";
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
        system,
        stepNumber: 0,
      })
    );

    expect(step).toEqual({
      activeTools: ["nakafa"],
      toolChoice: { type: "tool", toolName: "nakafa" },
    });
  });

  it("reinforces final source policy after the first page-fetch step", () => {
    const step = Effect.runSync(
      prepareChatStep({
        messages: emptyMessages,
        needsPageFetch: true,
        system,
        stepNumber: 1,
      })
    );

    expect(step).toEqual({
      system: expect.stringContaining(
        "Never append a final source, reference, citation, or bibliography section"
      ),
    });
  });

  it("requires grounding on the first non-page-fetch step", () => {
    const step = Effect.runSync(
      prepareChatStep({
        messages: emptyMessages,
        needsPageFetch: false,
        system,
        stepNumber: 0,
      })
    );

    expect(step).toEqual({
      toolChoice: "required",
    });
  });

  it("reinforces final source policy after the first non-page-fetch step", () => {
    const step = Effect.runSync(
      prepareChatStep({
        messages: emptyMessages,
        needsPageFetch: false,
        system,
        stepNumber: 1,
      })
    );

    expect(step).toEqual({
      system: expect.stringContaining(
        "Cite sources inline in the exact sentence they support."
      ),
    });
  });

  it("forces research for first-step external URL requests", () => {
    const step = Effect.runSync(
      prepareChatStep({
        messages: externalUrlMessages,
        needsPageFetch: false,
        system,
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
        system,
        stepNumber: 0,
      })
    );

    expect(step).toEqual({
      activeTools: ["nakafa"],
      toolChoice: { type: "tool", toolName: "nakafa" },
    });
  });
});
