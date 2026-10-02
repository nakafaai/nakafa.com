import { describe, expect, it } from "@effect/vitest";
import { make } from "@repo/backend/confect/gateway/handle";
import { ModelKey } from "@repo/backend/confect/gateway/model";
import { Purpose } from "@repo/backend/confect/gateway/purpose";
import { Space } from "@repo/backend/confect/space";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, Record as Rec, Schema } from "effect";

const personal = Schema.decodeUnknownSync(Space)({
  kind: "personal",
  userId: "user-1",
});
const tenant = Schema.decodeUnknownSync(Space)({
  kind: "tenant",
  tenantId: "tenant-1",
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

/**
 * What each kind of space reports with a call: a school spends under its
 * tenant, and a personal space names no one.
 */
const attribution = {
  personal: {
    space: personal,
    reported: { tags: ["space:personal", "purpose:chat"] },
  },
  tenant: {
    space: tenant,
    reported: { tags: ["space:tenant", "purpose:chat"], user: "tenant-1" },
  },
} satisfies Record<Space["kind"], { space: Space; reported: object }>;

/** A gateway over one recording model. */
function serve() {
  const model = new MockLanguageModelV4({
    doGenerate: answer,
    doStream: { stream: new ReadableStream() },
  });
  const languageModel = vi.fn<Parameters<typeof make>[0]["languageModel"]>(
    () => model
  );
  return { gateway: make({ languageModel }), languageModel, model };
}

describe("Gateway handles", () => {
  it.effect.each(Arr.cartesian(Purpose.literals, ModelKey.literals))(
    "gives %s on %s today's routing, Gemini options and deadlines",
    ([purpose, key]) =>
      Effect.gen(function* () {
        const { gateway, languageModel, model } = serve();
        const handle = gateway.language({
          purpose,
          model: key,
          space: personal,
        });
        yield* Effect.promise(() => handle.model.doGenerate({ prompt }));
        expect(languageModel).toHaveBeenCalledExactlyOnceWith(gateways[key]);
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
      })
  );

  it.effect(
    "replaces a call site's routing while its reasoning options still apply",
    () =>
      Effect.gen(function* () {
        const { gateway, model } = serve();
        const handle = gateway.language({
          purpose: "chat",
          model: "nakafa-pro",
          space: tenant,
        });
        const providerOptions = {
          gateway: {
            disallowPromptTraining: false,
            models: ["openai/gpt-5"],
            only: ["openai"],
            order: ["openai"],
            user: "learner@example.com",
          },
          google: { thinkingConfig: { thinkingLevel: "minimal" } },
        };
        yield* Effect.promise(() =>
          handle.model.doGenerate({ prompt, providerOptions })
        );
        yield* Effect.promise(() =>
          handle.model.doStream({ prompt, providerOptions })
        );
        expect(
          Arr.map(
            [model.doGenerateCalls[0], model.doStreamCalls[0]],
            (call) => call?.providerOptions
          )
        ).toEqual(
          Arr.replicate(
            {
              gateway: {
                disallowPromptTraining: true,
                only: ["google", "vertex"],
                sort: "ttft",
                tags: ["space:tenant", "purpose:chat"],
                user: "tenant-1",
              },
              google: {
                thinkingConfig: {
                  includeThoughts: true,
                  thinkingLevel: "minimal",
                },
              },
            },
            2
          )
        );
      })
  );

  it.effect.each(Rec.values(attribution))(
    "attributes spend for a $space.kind space",
    ({ space, reported }) =>
      Effect.gen(function* () {
        const { gateway, model } = serve();
        const handle = gateway.language({
          purpose: "chat",
          model: "nakafa-lite",
          space,
        });
        yield* Effect.promise(() => handle.model.doGenerate({ prompt }));
        expect(
          model.doGenerateCalls[0]?.providerOptions?.gateway
        ).toStrictEqual({
          disallowPromptTraining: true,
          only: ["google", "vertex"],
          sort: "ttft",
          ...reported,
        });
      })
  );

  it("keeps the served model's identity for usage accounting", () => {
    const { gateway, model } = serve();
    const handle = gateway.language({
      purpose: "background",
      model: "nakafa-lite",
      space: personal,
    });
    expect(handle.model.provider).toBe(model.provider);
    expect(handle.model.modelId).toBe(model.modelId);
  });
});
