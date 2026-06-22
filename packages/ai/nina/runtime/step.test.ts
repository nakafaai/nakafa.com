import type { ModelMessage } from "ai";
import { describe, expect, it } from "vitest";
import { createNinaPrepareStep, type NinaPrepareStep } from "./step";

const emptyMessages = [] satisfies ModelMessage[];
const system = "Base system prompt";
const externalUrlMessages = [
  {
    content:
      "Baca halaman https://ai-sdk.dev/docs/ai-sdk-core/devtools dan jelaskan peringatannya.",
    role: "user",
  },
] satisfies ModelMessage[];

describe("nina/runtime/step", () => {
  it("forces Nakafa on the first page-fetch step", async () => {
    const step = await readPreparedStep({
      messages: emptyMessages,
      needsPageFetch: true,
      stepNumber: 0,
    });

    expect(step).toEqual({
      activeTools: ["nakafa"],
      messages: [],
      toolChoice: { type: "tool", toolName: "nakafa" },
    });
  });

  it("reinforces final source policy after the first page-fetch step", async () => {
    const step = await readPreparedStep({
      messages: emptyMessages,
      needsPageFetch: true,
      stepNumber: 1,
    });

    expect(step).toEqual({
      messages: [],
      system: expect.stringContaining(
        "Never append a final source, reference, citation, or bibliography section"
      ),
    });
  });

  it("leaves low-risk first non-page-fetch prompts to the orchestrator prompt", async () => {
    const greetingMessages = [
      {
        content: "hi",
        role: "user",
      },
    ] satisfies ModelMessage[];

    const step = await readPreparedStep({
      messages: greetingMessages,
      needsPageFetch: false,
      stepNumber: 0,
    });

    expect(step).toEqual({
      messages: greetingMessages,
    });
    expect(step).not.toHaveProperty("activeTools");
    expect(step).not.toHaveProperty("toolChoice");
  });

  it("reinforces final source policy after the first non-page-fetch step", async () => {
    const step = await readPreparedStep({
      messages: emptyMessages,
      needsPageFetch: false,
      stepNumber: 1,
    });

    expect(step).toEqual({
      messages: [],
      system: expect.stringContaining(
        "Cite external research sources inline in the exact sentence they support."
      ),
    });
    expect(step).toEqual({
      messages: [],
      system: expect.stringContaining("Continuation Tool Guidance"),
    });
    expect(step).toEqual({
      messages: [],
      system: expect.stringContaining(
        "Call math before the final answer when:"
      ),
    });
    expect(step).toEqual({
      messages: [],
      system: expect.stringContaining(
        "- Nakafa selected educational math content."
      ),
    });
    expect(step).toEqual({
      messages: [],
      system: expect.stringContaining(
        "The math input must verify the exact example, exercise, answer key, and numeric claims that will appear in the final answer."
      ),
    });
    expect(step).toEqual({
      messages: [],
      system: expect.stringContaining(
        "After math returns, do not switch to different mathematical content unless you call math again for that replacement content."
      ),
    });
    expect(step).toEqual({
      messages: [],
      system: expect.stringContaining("Do not call math after Nakafa when:"),
    });
    expect(step).toEqual({
      messages: [],
      system: expect.stringContaining(
        "- The source summary contains no mathematical verification target."
      ),
    });
    expect(step).toEqual({
      messages: [],
      system: expect.stringContaining(
        "When research evidence contains markdown links, preserve those links in the final answer"
      ),
    });
    expect(step).toEqual({
      messages: [],
      system: expect.stringContaining(
        "Do not add product homepages, documentation links, or source links from memory."
      ),
    });
    expect(step).toEqual({
      messages: [],
      system: expect.stringContaining(
        "Do not add Nakafa source labels, Nakafa domain links, or citation-style links for Nakafa-owned content"
      ),
    });
  });

  it("forces research for first-step external URL requests", async () => {
    const step = await readPreparedStep({
      messages: externalUrlMessages,
      needsPageFetch: false,
      stepNumber: 0,
    });

    expect(step).toEqual({
      activeTools: ["deepResearch"],
      messages: externalUrlMessages,
      toolChoice: { type: "tool", toolName: "deepResearch" },
    });
  });

  it("keeps page fetch ahead of external URL requests", async () => {
    const step = await readPreparedStep({
      messages: externalUrlMessages,
      needsPageFetch: true,
      stepNumber: 0,
    });

    expect(step).toEqual({
      activeTools: ["nakafa"],
      messages: externalUrlMessages,
      toolChoice: { type: "tool", toolName: "nakafa" },
    });
  });

  it("keeps prepared model messages available to later model steps", async () => {
    const messages = [
      {
        content: "Cek kabar tryout.",
        role: "user",
      },
      {
        content: "Jawaban terlihat.",
        role: "assistant",
      },
    ] satisfies ModelMessage[];

    const step = await readPreparedStep({
      messages,
      needsPageFetch: false,
      stepNumber: 1,
    });

    expect(step?.messages).toEqual(messages);
  });

  it("leaves continuation tool choice to the model", async () => {
    const messages = [
      {
        content: [
          {
            text: "No Nakafa evidence here.",
            type: "text",
          },
          {
            input: {
              objective: "Research current public information.",
              request: "current public information",
              requirements: [],
              sourceRequirements: ["current public sources"],
            },
            toolCallId: "research-call",
            toolName: "deepResearch",
            type: "tool-call",
          },
        ],
        role: "assistant",
      },
    ] satisfies ModelMessage[];

    const step = await readPreparedStep({
      messages,
      needsPageFetch: false,
      stepNumber: 1,
    });

    expect(step).toEqual({
      messages,
      system: expect.stringContaining("Continuation Source Policy"),
    });
    expect(step).not.toHaveProperty("activeTools");
    expect(step).not.toHaveProperty("toolChoice");
  });
});

/**
 * Runs Nina's deterministic step policy through the AI SDK callback contract.
 *
 * Tests exercise the public SDK-derived callback shape so package behavior
 * stays aligned with `ToolLoopAgentSettings["prepareStep"]` instead of a local
 * imitation of the callback input.
 */
function readPreparedStep({
  messages,
  needsPageFetch,
  stepNumber,
}: {
  readonly messages: ModelMessage[];
  readonly needsPageFetch: boolean;
  readonly stepNumber: number;
}) {
  const prepareStep = createNinaPrepareStep({ needsPageFetch, system });

  return prepareStep({
    experimental_context: undefined,
    messages,
    model: "google/gemini-3-flash",
    stepNumber,
    steps: [],
  } satisfies Parameters<NinaPrepareStep>[0]);
}
