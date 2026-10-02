import { describe, expect, it } from "@effect/vitest";
import { make } from "@repo/backend/confect/gateway/handle";
import { ModelKey } from "@repo/backend/confect/gateway/model";
import { Purpose } from "@repo/backend/confect/gateway/purpose";
import { Space } from "@repo/backend/confect/space";
import { MockLanguageModelV4 } from "ai/test";
import { Schema } from "effect";

const space = Schema.decodeUnknownSync(Space)({
  kind: "personal",
  userId: "user-1",
});
const prompt = [
  { role: "user" as const, content: [{ type: "text" as const, text: "Hi" }] },
];
const answer = {
  content: [{ type: "text" as const, text: "Hello" }],
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
  warnings: [],
};
const fast = { thinkingConfig: { thinkingLevel: "low" } };
const interactive = {
  thinkingConfig: { includeThoughts: true, thinkingLevel: "high" },
};
/** Today's deadlines and reasoning effort for every purpose. */
const expected = {
  chat: {
    google: interactive,
    timeout: { chunkMs: 45_000, stepMs: 90_000, totalMs: 420_000 },
  },
  specialist: { google: fast, timeout: { stepMs: 30_000, totalMs: 120_000 } },
  background: { google: fast, timeout: { stepMs: 15_000, totalMs: 45_000 } },
  suggestion: { google: fast, timeout: { stepMs: 30_000, totalMs: 90_000 } },
  presentation: { google: fast, timeout: { stepMs: 15_000, totalMs: 45_000 } },
};
const gateways = {
  "nakafa-lite": "google/gemini-3.5-flash-lite",
  "nakafa-pro": "google/gemini-3.7-flash",
};

/** What each kind of space reports with a call; a personal space names no one. */
const attribution = {
  personal: { space, reported: { tags: ["space:personal", "purpose:chat"] } },
} satisfies Record<Space["kind"], { space: Space; reported: object }>;

/** A gateway over one recording model, and the gateway model IDs it served. */
function serve() {
  const model = new MockLanguageModelV4({
    doGenerate: answer,
    doStream: { stream: new ReadableStream() },
  });
  const served: string[] = [];
  const gateway = make({
    languageModel: (id) => {
      served.push(id);
      return model;
    },
  });
  return { gateway, model, served };
}

describe("Gateway handles", () => {
  it.each(
    Purpose.literals.flatMap((purpose) =>
      ModelKey.literals.map((key) => [purpose, key] as const)
    )
  )(
    "gives %s on %s today's routing, Gemini options and deadlines",
    async (purpose, key) => {
      const { gateway, model, served } = serve();
      const handle = gateway.language({ purpose, model: key, space });
      await handle.model.doGenerate({ prompt });
      expect(served).toEqual([gateways[key]]);
      expect(handle.timeout).toEqual(expected[purpose].timeout);
      expect(model.doGenerateCalls[0]?.providerOptions).toEqual({
        gateway: {
          disallowPromptTraining: true,
          only: ["google", "vertex"],
          sort: "ttft",
          tags: ["space:personal", `purpose:${purpose}`],
        },
        google: expected[purpose].google,
      });
    }
  );

  it("replaces a call site's routing while its reasoning options still apply", async () => {
    const { gateway, model } = serve();
    const handle = gateway.language({
      purpose: "chat",
      model: "nakafa-pro",
      space,
    });
    const providerOptions = {
      gateway: {
        disallowPromptTraining: false,
        models: ["openai/gpt-5"],
        only: ["openai"],
        order: ["openai"],
      },
      google: { thinkingConfig: { thinkingLevel: "minimal" } },
    };
    await handle.model.doGenerate({ prompt, providerOptions });
    await handle.model.doStream({ prompt, providerOptions });
    for (const call of [model.doGenerateCalls[0], model.doStreamCalls[0]]) {
      expect(call?.providerOptions).toEqual({
        gateway: {
          disallowPromptTraining: true,
          only: ["google", "vertex"],
          sort: "ttft",
          tags: ["space:personal", "purpose:chat"],
        },
        google: {
          thinkingConfig: { includeThoughts: true, thinkingLevel: "minimal" },
        },
      });
    }
  });

  it.each(Object.values(attribution))(
    "attributes spend for a $space.kind space",
    async ({ space: owner, reported }) => {
      const { gateway, model } = serve();
      await gateway
        .language({ purpose: "chat", model: "nakafa-lite", space: owner })
        .model.doGenerate({ prompt });
      expect(model.doGenerateCalls[0]?.providerOptions?.gateway).toEqual({
        disallowPromptTraining: true,
        only: ["google", "vertex"],
        sort: "ttft",
        ...reported,
      });
    }
  );

  it("keeps the served model's identity for usage accounting", () => {
    const { gateway, model } = serve();
    const handle = gateway.language({
      purpose: "background",
      model: "nakafa-lite",
      space,
    });
    expect(handle.model.provider).toBe(model.provider);
    expect(handle.model.modelId).toBe(model.modelId);
  });
});
