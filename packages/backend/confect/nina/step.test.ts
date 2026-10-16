import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { languageModel } from "@repo/backend/confect/gateway/model";
import {
  CAPABILITY_BUDGET,
  makeChatStep,
  timeLeft,
} from "@repo/backend/confect/nina/capability/deadline";
import {
  type LearningCapabilityName,
  LearningCapabilityNameSchema,
} from "@repo/backend/confect/nina/capability/spec";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import { startNinaStep } from "@repo/backend/confect/nina/step";
import { deployment, provider } from "@repo/backend/test/gateway";
import {
  createNinaTest,
  ninaModel,
  ninaStream,
  ninaToolInput,
  ninaUsage,
} from "@repo/backend/test/nina";
import { encodeJsonText } from "@repo/utilities/json";
import type { ModelMessage } from "ai";
import { Array as Arr, Clock, Duration, Effect, MutableRef } from "effect";
import { TestClock } from "effect/testing";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));
vi.mock("@repo/backend/confect/nina/nakafa/agent", () => ({
  runNakafaAgent: vi.fn(),
}));

const run = Ref.getFunctionReference(refs.internal.nina.response.run);

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

/** Every capability Nina has, as a turn that may use them all is offered them. */
const everything = LearningCapabilityNameSchema.literals;

/**
 * Builds the input of Nina's step callback as the AI SDK calls it.
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
    model: languageModel.id,
    responseMessages: [],
    runtimeContext: {},
    stepNumber,
    steps: [],
    toolsContext: {},
  } satisfies Parameters<typeof startNinaStep>[2];
}

/** Starts a step of a turn that offers `capabilities`, whose timer needs no mark. */
function readPreparedStep(
  options: Parameters<typeof stepInput>[0],
  capabilities: readonly LearningCapabilityName[] = everything
) {
  return startNinaStep(Effect.void, capabilities, stepInput(options));
}

describe("nina/runtime/step", () => {
  it.effect("leaves low-risk first prompts to Nina's system prompt", () =>
    Effect.gen(function* () {
      const greetingMessages = [
        { content: "hi", role: "user" },
      ] satisfies ModelMessage[];

      expect(
        yield* readPreparedStep({ messages: greetingMessages, stepNumber: 0 })
      ).toEqual({ messages: greetingMessages });
    })
  );

  it.effect(
    "starts with research when the first prompt names a source, with every tool still listed",
    () =>
      Effect.gen(function* () {
        const step = yield* readPreparedStep({
          messages: externalUrlMessages,
          stepNumber: 0,
        });

        expect(step).toEqual({
          messages: externalUrlMessages,
          toolChoice: { type: "tool", toolName: "deepResearch" },
        });
        expect(step).not.toHaveProperty("activeTools");
      })
  );

  it.effect(
    "starts with Nakafa, not research, when the first prompt links to Nakafa's own site",
    () =>
      Effect.gen(function* () {
        const step = yield* readPreparedStep({
          messages: nakafaUrlMessages,
          stepNumber: 0,
        });

        expect(step).toEqual({
          messages: nakafaUrlMessages,
          toolChoice: { type: "tool", toolName: "nakafa" },
        });
        expect(step).not.toHaveProperty("activeTools");
      })
  );

  it.effect(
    "starts with research when the first prompt links to Nakafa and to an outside site",
    () =>
      Effect.gen(function* () {
        expect(
          yield* readPreparedStep({ messages: mixedUrlMessages, stepNumber: 0 })
        ).toEqual({
          messages: mixedUrlMessages,
          toolChoice: { type: "tool", toolName: "deepResearch" },
        });
      })
  );

  it.effect.each([
    [
      "an outside link when research is not offered",
      externalUrlMessages,
      ["nakafa", "math", "memory"],
    ],
    [
      "a link to Nakafa when Nakafa is not offered",
      nakafaUrlMessages,
      ["deepResearch", "math", "memory"],
    ],
    [
      "both links when neither is offered",
      mixedUrlMessages,
      ["math", "memory"],
    ],
  ] as const)(
    "forces no tool for %s, because the SDK lists only the tools the turn offers",
    ([, messages, offered]) =>
      Effect.gen(function* () {
        expect(
          yield* readPreparedStep({ messages, stepNumber: 0 }, offered)
        ).toEqual({ messages });
      })
  );

  it.effect(
    "starts with Nakafa when the first prompt links to both and the turn offers no research",
    () =>
      Effect.gen(function* () {
        expect(
          yield* readPreparedStep(
            { messages: mixedUrlMessages, stepNumber: 0 },
            ["nakafa", "math"]
          )
        ).toEqual({
          messages: mixedUrlMessages,
          toolChoice: { type: "tool", toolName: "nakafa" },
        });
      })
  );

  it.effect(
    "changes neither the instructions nor the tools after the first step, so the cached prefix holds",
    () =>
      Effect.gen(function* () {
        const step = yield* readPreparedStep({
          messages: externalUrlMessages,
          stepNumber: 1,
        });

        expect(step).toEqual({ messages: externalUrlMessages });
        expect(
          yield* readPreparedStep({
            messages: nakafaUrlMessages,
            stepNumber: 1,
          })
        ).toEqual({ messages: nakafaUrlMessages });
      })
  );

  it.effect(
    "marks when every step began, before it prepares the step, so the tools it runs count from there",
    () =>
      Effect.gen(function* () {
        const chatStep = yield* makeChatStep();
        yield* TestClock.adjust("40 seconds");
        const prepared = yield* startNinaStep(
          chatStep.begin,
          everything,
          stepInput({ messages: externalUrlMessages, stepNumber: 0 })
        );
        expect(yield* chatStep.startedAt).toBe(yield* Clock.currentTimeMillis);
        expect(prepared).toEqual(
          yield* readPreparedStep({
            messages: externalUrlMessages,
            stepNumber: 0,
          })
        );
      })
  );
});

describe("the chat steps of a real Nina run", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.restoreAllMocks();
    deployment.mockReset();
    provider.languageModel.mockReset();
    vi.useRealTimers();
  });

  it("counts the time a capability has left from the start of the chat step it runs in", async () => {
    // Only the wall clock is faked, so the model's calls can take time at once.
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date"] });
    const lefts = MutableRef.make<readonly number[]>([]);
    vi.mocked(runNakafaAgent).mockImplementation(() =>
      Effect.map(timeLeft, (left) => {
        MutableRef.update(lefts, Arr.append(Duration.toMillis(left)));
        return { text: "Evidence." };
      })
    );
    const askNakafa = (toolCallId: string) => [
      { type: "stream-start" as const, warnings: [] },
      {
        type: "tool-call" as const,
        toolCallId,
        toolName: "nakafa",
        input: encodeJsonText(ninaToolInput),
      },
      {
        type: "finish" as const,
        usage: ninaUsage,
        finishReason: { unified: "tool-calls" as const, raw: "tool-calls" },
      },
    ];
    // Nina's own call takes 40 seconds in the first step and 5 in the second.
    const languageModel = ninaModel();
    const answer = languageModel.doStream;
    let step = 0;
    languageModel.doStream = (options) => {
      step += 1;
      if (step > 2) {
        return answer.call(languageModel, options);
      }
      vi.advanceTimersByTime(step === 1 ? 40_000 : 5000);
      return Promise.resolve(ninaStream(askNakafa(`read-${step}`)));
    };
    provider.languageModel.mockReturnValue(languageModel);
    const f = await createNinaTest({ prompt: "Explain a function limit." });
    await f.t.action(run, { turnId: f.turnId });
    await f.t.finishAllScheduledFunctions(() => undefined);
    expect((await f.inspect()).turn?.state.status).toBe("complete");
    const [first, second] = MutableRef.get(lefts);
    // The first run has what its step has left after Nina's call took 40 seconds.
    expect(first).toBeLessThanOrEqual(
      Duration.toMillis(CAPABILITY_BUDGET) - 40_000
    );
    // The second step began later and its call took 5 seconds, so its run has
    // more left, not less, than the first run had.
    expect(second - first).toBe(35_000);
  });
});
