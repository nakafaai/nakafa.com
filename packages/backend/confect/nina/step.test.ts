import { describe, expect, it } from "@effect/vitest";
import { makeChatStep } from "@repo/backend/confect/nina/capability/deadline";
import {
  type NinaPrepareStep,
  prepareNinaStep,
  startNinaStep,
} from "@repo/backend/confect/nina/step";
import type { ModelMessage } from "ai";
import { Clock, Effect } from "effect";
import { TestClock } from "effect/testing";

const externalUrlMessages = [
  {
    content:
      "Baca halaman https://ai-sdk.dev/docs/ai-sdk-core/devtools dan jelaskan peringatannya.",
    role: "user",
  },
] satisfies ModelMessage[];

const nakafaLessonUrl =
  "https://nakafa.com/en/subject/high-school/10/mathematics/exponential/basic-concept";
const nakafaUrlMessages = [
  { content: `Jelaskan halaman ${nakafaLessonUrl} dong.`, role: "user" },
] satisfies ModelMessage[];
const mixedUrlMessages = [
  {
    content: `Bandingkan ${nakafaLessonUrl} dengan https://ai-sdk.dev/docs/ai-sdk-core/devtools.`,
    role: "user",
  },
] satisfies ModelMessage[];

const instructions = "Base system prompt";

/**
 * Runs Nina's deterministic step policy through the AI SDK callback contract.
 *
 * Tests exercise the public SDK-derived callback shape so package behavior
 * stays aligned with `ToolLoopAgentSettings["prepareStep"]` instead of a local
 * imitation of the callback input.
 */
function stepInput({
  messages,
  stepNumber,
}: {
  readonly messages: ModelMessage[];
  readonly stepNumber: number;
}) {
  return {
    initialInstructions: instructions,
    initialMessages: messages,
    instructions,
    messages,
    model: "google/gemini-3.8-flash",
    responseMessages: [],
    runtimeContext: {},
    stepNumber,
    steps: [],
    toolsContext: {},
  } satisfies Parameters<NinaPrepareStep>[0];
}

function readPreparedStep(options: Parameters<typeof stepInput>[0]) {
  return prepareNinaStep(stepInput(options));
}

describe("nina/runtime/step", () => {
  it("leaves low-risk first prompts to Nina's system prompt", () => {
    const greetingMessages = [
      { content: "hi", role: "user" },
    ] satisfies ModelMessage[];

    expect(
      readPreparedStep({ messages: greetingMessages, stepNumber: 0 })
    ).toEqual({ messages: greetingMessages });
  });

  it("starts with research when the first prompt names a source, with every tool still listed", () => {
    const step = readPreparedStep({
      messages: externalUrlMessages,
      stepNumber: 0,
    });

    expect(step).toEqual({
      messages: externalUrlMessages,
      toolChoice: { type: "tool", toolName: "deepResearch" },
    });
    expect(step).not.toHaveProperty("activeTools");
  });

  it("starts with Nakafa, not research, when the first prompt links to Nakafa's own site", () => {
    const step = readPreparedStep({
      messages: nakafaUrlMessages,
      stepNumber: 0,
    });

    expect(step).toEqual({
      messages: nakafaUrlMessages,
      toolChoice: { type: "tool", toolName: "nakafa" },
    });
    expect(step).not.toHaveProperty("activeTools");
  });

  it("starts with research when the first prompt links to Nakafa and to an outside site", () => {
    expect(
      readPreparedStep({ messages: mixedUrlMessages, stepNumber: 0 })
    ).toEqual({
      messages: mixedUrlMessages,
      toolChoice: { type: "tool", toolName: "deepResearch" },
    });
  });

  it("changes neither the instructions nor the tools after the first step, so the cached prefix holds", () => {
    const step = readPreparedStep({
      messages: externalUrlMessages,
      stepNumber: 1,
    });

    expect(step).toEqual({ messages: externalUrlMessages });
    expect(
      readPreparedStep({ messages: nakafaUrlMessages, stepNumber: 1 })
    ).toEqual({ messages: nakafaUrlMessages });
  });

  it.effect(
    "marks when every step began, before it prepares the step, so the tools it runs count from there",
    () =>
      Effect.gen(function* () {
        const chatStep = yield* makeChatStep();
        yield* TestClock.adjust("40 seconds");
        const prepared = yield* startNinaStep(
          chatStep.begin,
          stepInput({ messages: externalUrlMessages, stepNumber: 0 })
        );
        expect(yield* chatStep.startedAt).toBe(yield* Clock.currentTimeMillis);
        expect(prepared).toEqual(
          readPreparedStep({ messages: externalUrlMessages, stepNumber: 0 })
        );
      })
  );
});
