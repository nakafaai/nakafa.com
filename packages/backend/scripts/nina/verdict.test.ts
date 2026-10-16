import type { MessageDoc } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { languageModel, providerId } from "@repo/backend/confect/gateway/model";
import { purposes } from "@repo/backend/confect/gateway/purpose";
import { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import type { NinaUsageTotal } from "@repo/backend/confect/nina/contract/usage";
import {
  START_DEADLINE,
  TURN_DEADLINE,
} from "@repo/backend/confect/nina/deadline";
import {
  chatSteps,
  GateTurn,
  hasFollowUp,
  isOpen,
  judgeTurn,
  StoredMessage,
} from "@repo/backend/scripts/nina/verdict";
import { Array as Arr, Duration, Schema } from "effect";

type Usage = typeof NinaUsageTotal.Type;

/** A row of the usage record as a call through the gateway handle leaves it. */
function usage(agent: Usage["agent"], fields: Partial<Usage> = {}): Usage {
  return {
    agent,
    calls: 1,
    input: 1000,
    model: languageModel.id,
    output: 100,
    provider: providerId,
    ...fields,
  };
}

const nina = usage("nina", {
  cached: 17_210,
  calls: 3,
  cost: 0.012_345,
  input: 21_034,
  output: 455,
  reasoning: 212,
});
const nakafa = usage("nakafa", {
  calls: 2,
  cost: 0.0012,
  input: 6120,
  output: 310,
});

/** A step of the chat agent in the journal, as the component stores it. */
function stored(
  fields: Partial<StoredMessage> = {},
  tokens: { cached?: number; input?: number; output?: number } = {}
): StoredMessage {
  return {
    agentName: "nina",
    finishReason: "stop",
    message: { role: "assistant" },
    status: "success",
    usage: {
      completionTokens: tokens.output ?? 100,
      promptTokens: tokens.input ?? 1000,
      ...(tokens.cached === undefined
        ? {}
        : { cachedInputTokens: tokens.cached }),
    },
    ...fields,
  };
}

/** Two chat steps: the first writes the prefix to the cache, the second reads it. */
const steps = chatSteps([
  stored({ finishReason: "tool-calls" }, { cached: 0, input: 10_234 }),
  stored({}, { cached: 10_200, input: 10_890 }),
]);

/** A turn that passes: complete in 31.5 seconds, a cache read, no step at its cap. */
const healthy = {
  order: 0,
  promptedAt: 1000,
  state: { finishedAt: 32_500, status: "complete" },
  suggestions: ["What is an exponent?"],
  usage: [nina, nakafa],
} satisfies GateTurn;

const withUsage = (rows: readonly Usage[]) => ({ ...healthy, usage: rows });

describe("the chat steps of the release gate", () => {
  it("takes the finished assistant messages of the chat agent, in order", () => {
    const messages = [
      stored({ agentName: "nakafa" }),
      stored({ message: { role: "user" } }),
      stored({ message: undefined }),
      stored({ status: "failed" }),
      stored({ status: "pending" }),
      stored({ status: undefined }),
      stored(
        { finishReason: "tool-calls" },
        { cached: 0, input: 5000, output: 80 }
      ),
      stored({ message: { role: "tool" } }),
      stored({}, { cached: 4900, input: 5100, output: 200 }),
    ];

    expect(chatSteps(messages)).toEqual([
      { cached: 0, finishReason: "tool-calls", input: 5000, output: 80 },
      { cached: 4900, finishReason: "stop", input: 5100, output: 200 },
    ]);
  });

  it("counts a step that reports no usage as zero tokens", () => {
    expect(
      chatSteps([
        stored({ finishReason: undefined, usage: undefined }),
        stored({ usage: {} }),
      ])
    ).toEqual([
      { cached: 0, finishReason: undefined, input: 0, output: 0 },
      { cached: 0, finishReason: "stop", input: 0, output: 0 },
    ]);
  });

  it("reads a message as the Agent component lists it", () => {
    const listed: MessageDoc = {
      _creationTime: 1,
      _id: "message-1",
      agentName: "nina",
      finishReason: "stop",
      message: { content: "Done.", role: "assistant" },
      model: languageModel.id,
      order: 0,
      provider: providerId,
      status: "success",
      stepOrder: 2,
      threadId: "thread-1",
      tool: false,
      usage: {
        cachedInputTokens: 4000,
        completionTokens: 90,
        promptTokens: 4500,
        raw: { anything: true },
      },
    };

    expect(chatSteps([Schema.decodeSync(StoredMessage)(listed)])).toEqual([
      { cached: 4000, finishReason: "stop", input: 4500, output: 90 },
    ]);
  });
});

describe("release gate verdict", () => {
  it("passes a complete turn that read the cache through the gateway", () => {
    expect(judgeTurn(healthy, steps)).toEqual([]);
  });

  it("reads a turn as the conversation query encodes it", () => {
    const summary: typeof NinaTurnSummary.Type = {
      order: 0,
      promptedAt: 1000,
      promptMessageId: "message-1",
      state: { finishedAt: 32_500, status: "complete" },
      suggestions: ["What is an exponent?"],
      usage: [nina, nakafa],
    };
    const failed: typeof NinaTurnSummary.Type = {
      ...summary,
      state: { finishedAt: 32_500, reason: "response-limit", status: "failed" },
    };

    // The encoded turn is the wire form, and decoding it checks at compile time
    // that the gate's schema accepts everything the product's schema encodes.
    const [read, readFailed] = Arr.map([summary, failed], (turn) =>
      Schema.decodeSync(GateTurn)(Schema.encodeSync(NinaTurnSummary)(turn))
    );

    expect(read ? judgeTurn(read, steps) : "unread").toEqual([]);
    expect(readFailed ? judgeTurn(readFailed, steps) : "unread").toEqual([
      "The turn is failed with the reason response-limit, not complete.",
    ]);
  });

  it.each([
    [
      { finishedAt: 5000, reason: "response-timeout", status: "failed" },
      "The turn is failed with the reason response-timeout, not complete.",
    ],
    [
      { finishedAt: 5000, status: "cancelled" },
      "The turn is cancelled, not complete.",
    ],
  ])("fails a turn that ended %j", (state, sentence) => {
    expect(judgeTurn({ ...healthy, state }, steps)).toEqual([sentence]);
  });

  it("fails a turn that has not ended, which has no end to measure either", () => {
    expect(
      judgeTurn({ ...healthy, state: { status: "running" } }, steps)
    ).toEqual([
      "The turn is running, not complete.",
      "The turn has no recorded start and end to measure.",
    ]);
  });

  it("fails calls that did not go through the gateway handle", () => {
    const wrongProvider = usage("title", { provider: "gateway" });
    const wrongModel = usage("suggestions", { model: "google/other" });

    expect(
      judgeTurn(withUsage([nina, wrongProvider, wrongModel]), steps)
    ).toEqual([
      `The title calls ran on ${languageModel.id} through gateway, not on ${languageModel.id} through ${providerId}.`,
      `The suggestions calls ran on google/other through ${providerId}, not on ${languageModel.id} through ${providerId}.`,
    ]);
  });

  it("fails a turn that recorded no call", () => {
    expect(judgeTurn(withUsage([]), steps)).toEqual([
      "The turn recorded no model call.",
    ]);
  });

  it("fails when the chat agent took fewer than two steps, which leaves nothing to read from the cache", () => {
    const sentence = (taken: number) =>
      `The nina agent took ${taken} of the 2 steps the gate needs, so no later step could read what the first one cached.`;

    expect(judgeTurn(healthy, Arr.take(steps, 1))).toEqual([sentence(1)]);
    expect(judgeTurn(healthy, [])).toEqual([sentence(0)]);
  });

  it("fails each step after the first that read nothing from the cache", () => {
    const cold = chatSteps([
      stored({}, { cached: 0, input: 9000 }),
      stored({}, { cached: 0, input: 9100 }),
      stored({}, { cached: 8000, input: 9200 }),
      stored({}, { input: 9300 }),
    ]);

    expect(judgeTurn(healthy, cold)).toEqual([
      "Step 2 of the nina agent read no input tokens from the cache (9100 input tokens). A short prompt is not cached, so check that the lesson page the question names still exists.",
      "Step 4 of the nina agent read no input tokens from the cache (9300 input tokens). A short prompt is not cached, so check that the lesson page the question names still exists.",
    ]);
  });

  it("accepts a first step that already read the cache", () => {
    const warm = chatSteps([
      stored({}, { cached: 9000, input: 9500 }),
      stored({}, { cached: 9000, input: 9800 }),
    ]);

    expect(judgeTurn(healthy, warm)).toEqual([]);
  });

  it("fails a chat step that ended at its output cap, by the finish reason or by the tokens", () => {
    const cap = languageModel.output.chat;
    const capped = chatSteps([
      stored({ finishReason: "length" }, { cached: 0, output: 50 }),
      stored({}, { cached: 500, output: cap }),
      stored({}, { cached: 500, output: cap - 1 }),
    ]);

    expect(judgeTurn(healthy, capped)).toEqual([
      `Step 1 of the nina agent ended at its output cap of ${cap} tokens (50 tokens written).`,
      `Step 2 of the nina agent ended at its output cap of ${cap} tokens (${cap} tokens written).`,
    ]);
  });

  it.each([
    ["nakafa", languageModel.output.specialist],
    ["research", languageModel.output.specialist],
    ["math", languageModel.output.specialist],
    ["math-repair", languageModel.output.background],
    ["memory", languageModel.output.background],
    ["nina-repair", languageModel.output.background],
    ["suggestions", languageModel.output.suggestion],
    ["title", languageModel.output.presentation],
  ] as const)(
    "holds the %s agent to a cap of %i tokens a step",
    (agent, cap) => {
      const others = Arr.filter(healthy.usage, (row) => row.agent !== agent);
      const row = (output: number) => usage(agent, { calls: 2, output });

      expect(judgeTurn(withUsage([...others, row(2 * cap)]), steps)).toEqual([
        `The ${agent} agent wrote ${2 * cap} tokens, at least the ${2 * cap} that its calls (2) write at their cap of ${cap} tokens each.`,
      ]);
      expect(
        judgeTurn(withUsage([...others, row(2 * cap - 1)]), steps)
      ).toEqual([]);
    }
  );

  it("judges the chat agent by its steps and not by the sum of its row", () => {
    const heavy = usage("nina", {
      cached: 1,
      calls: 2,
      output: 2 * languageModel.output.chat,
    });

    expect(judgeTurn(withUsage([heavy, nakafa]), steps)).toEqual([]);
  });

  it("fails a turn that took longer than the deadline the product gives a turn", () => {
    const limit = Duration.toMillis(TURN_DEADLINE);

    expect(
      judgeTurn(
        {
          ...healthy,
          state: { finishedAt: 1000 + limit + 1, status: "complete" },
        },
        steps
      )
    ).toEqual([
      `The turn took ${(limit + 1) / 1000} seconds, longer than its deadline of ${limit / 1000} seconds.`,
    ]);
    expect(
      judgeTurn(
        {
          ...healthy,
          state: { finishedAt: 1000 + limit, status: "complete" },
        },
        steps
      )
    ).toEqual([]);
  });

  it("accepts a turn that waited to start and then used the whole chat call, which the product allows", () => {
    const elapsed =
      Duration.toMillis(START_DEADLINE) + purposes.chat.timeout.totalMs;

    expect(
      judgeTurn(
        {
          ...healthy,
          state: { finishedAt: 1000 + elapsed, status: "complete" },
        },
        steps
      )
    ).toEqual([]);
  });

  it("fails a turn without a recorded start or end", () => {
    const sentence = "The turn has no recorded start and end to measure.";

    expect(
      judgeTurn({ order: 0, state: healthy.state, usage: healthy.usage }, steps)
    ).toEqual([sentence]);
    expect(
      judgeTurn(
        {
          order: 0,
          promptedAt: 1000,
          state: { status: "complete" },
          usage: healthy.usage,
        },
        steps
      )
    ).toEqual([sentence]);
  });

  it("lists every failure in the order of the gate", () => {
    const failures = judgeTurn(
      {
        order: 0,
        promptedAt: 1000,
        state: { finishedAt: 1_000_000, status: "failed" },
        usage: [
          usage("nina", { provider: "gateway" }),
          usage("title", { calls: 1, output: 512 }),
        ],
      },
      Arr.take(steps, 1)
    );

    expect(Arr.map(failures, (sentence) => sentence.slice(0, 20))).toEqual([
      "The turn is failed, ",
      "The nina calls ran o",
      "The nina agent took ",
      "The title agent wrot",
      "The turn took 999 se",
    ]);
  });

  it("recognizes a turn that can still change", () => {
    expect(isOpen({ ...healthy, state: { status: "queued" } })).toBe(true);
    expect(isOpen({ ...healthy, state: { status: "running" } })).toBe(true);
    expect(isOpen(healthy)).toBe(false);
  });

  it("waits for the title call of the first turn of a chat, which runs after the suggestions", () => {
    const named = withUsage([...healthy.usage, usage("title", { output: 8 })]);

    expect(hasFollowUp(healthy)).toBe(false);
    expect(hasFollowUp(named)).toBe(true);
  });

  it("waits for the suggestions, and for no title after the first turn", () => {
    const named = withUsage([...healthy.usage, usage("title", { output: 8 })]);

    expect(hasFollowUp({ ...healthy, order: 1 })).toBe(true);
    expect(hasFollowUp({ ...named, suggestions: undefined })).toBe(false);
    expect(
      hasFollowUp({ order: 1, state: healthy.state, usage: healthy.usage })
    ).toBe(false);
  });
});
