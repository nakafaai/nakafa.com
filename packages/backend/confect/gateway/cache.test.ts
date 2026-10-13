import { describe, expect, it } from "@effect/vitest";
import { cachedPrefix } from "@repo/backend/confect/gateway/cache";
import { wrapLanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

const marker = { openaiCompatible: { cache_control: { type: "ephemeral" } } };
const system = { role: "system" as const, content: "Static instructions." };
const earlier = {
  role: "user" as const,
  content: [{ type: "text" as const, text: "An earlier question." }],
};
const answer = {
  role: "assistant" as const,
  content: [{ type: "text" as const, text: "An earlier answer." }],
};
const question = {
  role: "user" as const,
  content: [{ type: "text" as const, text: "The newest question." }],
};
const call = {
  role: "assistant" as const,
  content: [
    {
      type: "tool-call" as const,
      toolCallId: "call-1",
      toolName: "nakafa",
      input: {},
    },
  ],
};
const evidence = {
  role: "tool" as const,
  content: [
    {
      type: "tool-result" as const,
      toolCallId: "call-1",
      toolName: "nakafa",
      output: { type: "text" as const, value: "Evidence." },
    },
  ],
};
/** What the model under test answers every call with. */
const reply = {
  content: [{ type: "text" as const, text: "Hello" }],
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
  warnings: [],
};

/** The prompt a model receives when a call with `prompt` goes through the middleware. */
const received = Effect.fn("test.cache.received")(function* (
  prompt: Parameters<MockLanguageModelV4["doGenerate"]>[0]["prompt"]
) {
  const model = new MockLanguageModelV4({ doGenerate: reply });
  yield* Effect.promise(() =>
    wrapLanguageModel({ model, middleware: cachedPrefix }).doGenerate({
      prompt,
    })
  );
  return model.doGenerateCalls[0]?.prompt;
});

describe("the cached prompt prefix", () => {
  it.effect(
    "marks the system message of a first turn, never the newest question",
    () =>
      Effect.gen(function* () {
        expect(yield* received([system, question])).toEqual([
          { ...system, providerOptions: marker },
          question,
        ]);
      })
  );

  it.effect(
    "keeps the marker on the same message in every later step of a turn",
    () =>
      Effect.gen(function* () {
        const first = yield* received([system, earlier, answer, question]);
        const later = yield* received([
          system,
          earlier,
          answer,
          question,
          call,
          evidence,
        ]);
        const prefix = [
          system,
          earlier,
          { ...answer, providerOptions: marker },
        ];
        expect(first).toEqual([...prefix, question]);
        expect(later).toEqual([...prefix, question, call, evidence]);
      })
  );

  it.effect(
    "marks the last part of a user or tool message, where the gateway reads it",
    () =>
      Effect.gen(function* () {
        const attached = {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "See the file." },
            { type: "text" as const, text: "And this note." },
          ],
        };
        expect(yield* received([system, attached, question])).toEqual([
          system,
          {
            ...attached,
            content: [
              attached.content[0],
              { ...attached.content[1], providerOptions: marker },
            ],
          },
          question,
        ]);
        expect(
          yield* received([system, earlier, call, evidence, question])
        ).toEqual([
          system,
          earlier,
          call,
          {
            ...evidence,
            content: [{ ...evidence.content[0], providerOptions: marker }],
          },
          question,
        ]);
      })
  );

  it.effect("keeps the options a message already carries", () =>
    Effect.gen(function* () {
      const signed = {
        ...answer,
        providerOptions: {
          google: { thoughtSignature: "signature" },
          openaiCompatible: { reasoning: "kept" },
        },
      };
      expect(
        (yield* received([system, earlier, signed, question]))?.[2]
      ).toEqual({
        ...answer,
        providerOptions: {
          google: { thoughtSignature: "signature" },
          openaiCompatible: {
            cache_control: { type: "ephemeral" },
            reasoning: "kept",
          },
        },
      });
    })
  );

  it.effect(
    "leaves a prompt without a user message, or with nothing before it, unmarked",
    () =>
      Effect.gen(function* () {
        expect(yield* received([system])).toEqual([system]);
        expect(yield* received([question])).toEqual([question]);
      })
  );
});
