import { describe, expect, it } from "@effect/vitest";
import {
  createNinaPrepareStep,
  type NinaPrepareStep,
} from "@repo/backend/confect/nina/step";
import type { ModelMessage } from "ai";

const emptyMessages = [] satisfies ModelMessage[];
const instructions = "Base system prompt";
const externalUrlMessages = [
  {
    content:
      "Baca halaman https://ai-sdk.dev/docs/ai-sdk-core/devtools dan jelaskan peringatannya.",
    role: "user",
  },
] satisfies ModelMessage[];

describe("nina/runtime/step", () => {
  it("leaves low-risk first prompts to Nina's system prompt", () => {
    const greetingMessages = [
      {
        content: "hi",
        role: "user",
      },
    ] satisfies ModelMessage[];

    const step = readPreparedStep({
      messages: greetingMessages,
      stepNumber: 0,
    });

    expect(step).toEqual({
      messages: greetingMessages,
    });
    expect(step).not.toHaveProperty("activeTools");
    expect(step).not.toHaveProperty("toolChoice");
  });

  it("reinforces final source policy after the first step", () => {
    const step = readPreparedStep({
      messages: emptyMessages,
      stepNumber: 1,
    });

    expect(step).toEqual({
      instructions: expect.stringContaining(
        "Cite external research sources inline in the exact sentence they support."
      ),
      messages: [],
    });
    expect(step).toEqual({
      instructions: expect.stringContaining("Continuation Tool Guidance"),
      messages: [],
    });
    expect(step).toEqual({
      instructions: expect.stringContaining(
        "Call math before the final answer when:"
      ),
      messages: [],
    });
    expect(step).toEqual({
      instructions: expect.stringContaining(
        "- Nakafa selected educational math content."
      ),
      messages: [],
    });
    expect(step).toEqual({
      instructions: expect.stringContaining(
        "The math input must verify the exact example, exercise, answer key, and numeric claims that will appear in the final answer."
      ),
      messages: [],
    });
    expect(step).toEqual({
      instructions: expect.stringContaining(
        "After math returns, do not switch to different mathematical content unless you call math again for that replacement content."
      ),
      messages: [],
    });
    expect(step).toEqual({
      instructions: expect.stringContaining(
        "Do not call math after Nakafa when:"
      ),
      messages: [],
    });
    expect(step).toEqual({
      instructions: expect.stringContaining(
        "- The source summary contains no mathematical verification target."
      ),
      messages: [],
    });
    expect(step).toEqual({
      instructions: expect.stringContaining(
        "When research evidence contains markdown links, preserve those links in the final answer"
      ),
      messages: [],
    });
    expect(step).toEqual({
      instructions: expect.stringContaining(
        "Do not add product homepages, documentation links, or source links from memory."
      ),
      messages: [],
    });
    expect(step).toEqual({
      instructions: expect.stringContaining(
        "Do not add Nakafa source labels, Nakafa domain links, or citation-style links for Nakafa-owned content"
      ),
      messages: [],
    });
  });

  it("forces research for first-step external URL requests", () => {
    const step = readPreparedStep({
      messages: externalUrlMessages,
      stepNumber: 0,
    });

    expect(step).toEqual({
      activeTools: ["deepResearch"],
      messages: externalUrlMessages,
      toolChoice: { type: "tool", toolName: "deepResearch" },
    });
  });

  it("keeps prepared model messages available to later model steps", () => {
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

    const step = readPreparedStep({
      messages,
      stepNumber: 1,
    });

    expect(step?.messages).toEqual(messages);
  });

  it("leaves continuation tool choice to the model", () => {
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

    const step = readPreparedStep({
      messages,
      stepNumber: 1,
    });

    expect(step).toEqual({
      instructions: expect.stringContaining("Continuation Source Policy"),
      messages,
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
  stepNumber,
}: {
  readonly messages: ModelMessage[];
  readonly stepNumber: number;
}) {
  const prepareStep = createNinaPrepareStep({ instructions });

  return prepareStep({
    initialInstructions: instructions,
    initialMessages: messages,
    instructions,
    messages,
    model: "google/gemini-3.5-flash-lite",
    responseMessages: [],
    runtimeContext: {},
    stepNumber,
    steps: [],
    toolsContext: {},
  } satisfies Parameters<NinaPrepareStep>[0]);
}
