import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import { saveMessage } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import { curateMemory } from "@repo/backend/confect/nina/memory/curate";
import { GatewayTest, provider } from "@repo/backend/test/gateway";
import { createNinaTest } from "@repo/backend/test/nina";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

afterEach(() => {
  vi.restoreAllMocks();
  provider.languageModel.mockReset();
});

const enable = Ref.getFunctionReference(refs.public.nina.memory.enable);

/** A learner prompt, a way to curate it, and the stored memory. */
async function fixture(prompt = "Aku kelas 12 dan mau ikut SNBT 2027.") {
  const f = await createNinaTest({ prompt });
  const curate = (promptMessageId = f.promptMessageId) =>
    f.t.action((ctx) =>
      Effect.runPromise(
        curateMemory({
          chatId: f.chatId,
          promptMessageId,
          userId: f.identity.userId,
        }).pipe(
          Effect.provide([
            GatewayTest,
            RegisteredFunction.actionLayer(schema, ctx),
          ])
        )
      )
    );
  const memory = () =>
    f.t.query((ctx) => ctx.db.query("ninaMemories").collect());
  return { ...f, curate, memory };
}

/** A curator model that answers every call with `changes`. */
function curator(changes: object) {
  const model = new MockLanguageModelV4({
    doGenerate: providerStep([{ type: "text", text: JSON.stringify(changes) }]),
  });
  provider.languageModel.mockReturnValue(model);
  return model;
}

describe("Nina memory curation", () => {
  it("makes no model call while memory is off", async () => {
    const f = await fixture();
    const model = curator({ forget: [], remember: ["Kelas 12."], update: [] });
    await f.curate();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.memory()).toEqual([]);
  });

  it("remembers what the learner states about themself and shows the curator known facts", async () => {
    const f = await fixture();
    await f.owner.mutation(enable, {});
    const model = curator({
      forget: [],
      remember: ["Kelas 12, ikut SNBT 2027."],
      update: [],
    });
    await f.curate();
    await f.curate();
    expect(model.doGenerateCalls[0]?.providerOptions?.gateway?.tags).toEqual([
      "space:personal",
      "purpose:background",
    ]);
    const [first, second] = model.doGenerateCalls.map((call) =>
      JSON.stringify(call.prompt)
    );
    expect(first).toContain("Aku kelas 12 dan mau ikut SNBT 2027.");
    expect(first).toContain("Known facts: none");
    expect(first).toContain("Account: none");
    expect(second).toContain("[0] Kelas 12, ikut SNBT 2027.");
    expect(await f.memory()).toEqual([
      expect.objectContaining({
        facts: [
          expect.objectContaining({
            key: 0,
            text: "Kelas 12, ikut SNBT 2027.",
          }),
        ],
        usage: { calls: 2, input: 24, output: 8 },
      }),
    ]);
  });

  it("skips prompts without learner text", async () => {
    const f = await fixture("   ");
    await f.owner.mutation(enable, {});
    const model = curator({ forget: [], remember: ["Unused."], update: [] });
    await f.curate();
    const answer = await f.t.mutation((ctx) =>
      saveMessage(ctx, components.nina, {
        threadId: f.threadId,
        message: { role: "assistant", content: "Kamu kelas 12." },
      })
    );
    await f.curate(answer.messageId);
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.memory()).toEqual([
      expect.objectContaining({
        facts: [],
        usage: expect.objectContaining({ calls: 0 }),
      }),
    ]);
  });

  it("keeps memory unchanged when the prompt or the provider fails", async () => {
    const f = await fixture();
    await f.owner.mutation(enable, {});
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: () => Promise.reject(new Error("provider down")),
      })
    );
    await f.curate();
    await f.curate("not-a-message-id");
    expect(await f.memory()).toEqual([
      expect.objectContaining({
        facts: [],
        usage: expect.objectContaining({ calls: 0 }),
      }),
    ]);
  });

  it("records zero tokens when the provider omits usage counters", async () => {
    const f = await fixture();
    await f.owner.mutation(enable, {});
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: () =>
          Promise.resolve({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  forget: [],
                  remember: [],
                  update: [],
                }),
              },
            ],
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: {
                total: undefined,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: {
                total: undefined,
                text: undefined,
                reasoning: undefined,
              },
            },
            warnings: [],
          }),
      })
    );
    await f.curate();
    expect(await f.memory()).toEqual([
      expect.objectContaining({ usage: { calls: 1, input: 0, output: 0 } }),
    ]);
  });
});
