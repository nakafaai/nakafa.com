import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import { saveMessage } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import ninaTurns from "@repo/backend/confect/_generated/tables/ninaTurns";
import { captureMemory } from "@repo/backend/confect/nina/memory/capture";
import type { NinaMemoryCandidate } from "@repo/backend/confect/nina/memory.spec";
import { createUsageHandler } from "@repo/backend/confect/nina/usage";
import { GatewayTest, provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaModel } from "@repo/backend/test/nina";
import { memoryTools } from "@repo/backend/test/nina/memory";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, Logger, MutableRef, Schema } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const NOW = Date.UTC(2026, 9, 10, 12);
const MESSAGE = "Aku kelas 12 dan mau ikut SNBT 2027.";
const LESSON = "material:lesson:mathematics:material-section:limits";
const edit = Ref.getFunctionReference(refs.public.nina.memory.edit);
const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);
const remove = Ref.getFunctionReference(refs.public.nina.memory.remove);
const run = Ref.getFunctionReference(refs.internal.nina.response.run);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  provider.languageModel.mockReset();
});

/** A model that answers every capture call with these candidates. */
function answers(...memories: (typeof NinaMemoryCandidate.Type)[]) {
  const model = new MockLanguageModelV4({
    doGenerate: providerStep([
      { type: "text", text: encodeJsonText({ memories }) },
    ]),
  });
  provider.languageModel.mockReturnValue(model);
  return model;
}

/**
 * A model that answers like `answers`, but only after `meanwhile` ran: the
 * learner doing something while the model reads the message.
 */
function answersAfter(
  meanwhile: () => Promise<unknown>,
  ...memories: (typeof NinaMemoryCandidate.Type)[]
) {
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      await meanwhile();
      return providerStep([
        { type: "text", text: encodeJsonText({ memories }) },
      ]);
    },
  });
  provider.languageModel.mockReturnValue(model);
  return model;
}

/** A model whose capture call fails with this. */
function fails(error: () => Promise<never>) {
  const model = new MockLanguageModelV4({ doGenerate: error });
  provider.languageModel.mockReturnValue(model);
  return model;
}

/** What the learner states: their level, quoted from `MESSAGE`. */
const level: typeof NinaMemoryCandidate.Type = {
  kind: "level",
  quote: "Aku kelas 12",
  text: "Kelas 12.",
};

/** A learner who sent `prompt`, and a way to run one capture for that turn. */
async function fixture(prompt = MESSAGE) {
  const nina = await createNinaTest({ prompt });
  const f = { ...nina, ...memoryTools(nina) };
  const logged = MutableRef.make<readonly unknown[]>([]);
  const readTurn = async () =>
    Schema.decodeUnknownSync(ninaTurns.Doc)(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId))
    );
  const capture = async (promptMessageId?: string) => {
    const turn = await readTurn();
    return f.t.action((ctx) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const usageHandler = yield* createUsageHandler(turn._id);
          yield* captureMemory(
            promptMessageId === undefined ? turn : { ...turn, promptMessageId },
            usageHandler
          );
        }).pipe(
          Effect.provide([
            GatewayTest,
            RegisteredFunction.actionLayer(schema, ctx),
            Logger.layer([
              Logger.formatStructured.pipe(
                Logger.map(({ message }) =>
                  MutableRef.update(logged, Arr.append(message))
                )
              ),
            ]),
          ])
        )
      )
    );
  };
  const turn = () => f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId));
  return { ...f, capture, logged, turn };
}

/** The log entry of a capture that saved nothing. */
const unavailable = (fact: object) => [
  ["Nina memory unavailable", expect.objectContaining(fact)],
];

describe("memory capture", () => {
  it("asks no model about a message that says nothing about the learner", async () => {
    const f = await fixture("Explain a limit.");
    const model = answers(level);
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.stored()).toEqual([]);
    expect((await f.turn())?.usage).toEqual([]);
  });

  it("asks no model about a prompt that holds no words of the learner", async () => {
    const f = await fixture();
    const model = answers(level);
    const answer = await f.t.mutation((ctx) =>
      saveMessage(ctx, components.nina, {
        threadId: f.threadId,
        message: { role: "assistant", content: "Kamu kelas 12." },
      })
    );
    const picture = await f.t.mutation((ctx) =>
      saveMessage(ctx, components.nina, {
        threadId: f.threadId,
        message: {
          role: "user",
          content: [{ type: "image", image: "https://nakafa.com/image.png" }],
        },
      })
    );
    await f.capture(answer.messageId);
    await f.capture(picture.messageId);
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(MutableRef.get(f.logged)).toEqual([]);
  });

  it("asks no model while memory is paused", async () => {
    const f = await fixture();
    const model = answers(level);
    await f.owner.mutation(pause, { paused: true });
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.stored()).toEqual([]);
  });

  it("saves what the learner said about themself and records the call under the memory agent", async () => {
    const f = await fixture();
    const model = answers(level, {
      kind: "goal",
      quote: "mau ikut SNBT 2027",
      text: "Ikut SNBT 2027.",
    });
    await f.capture();
    expect(await f.texts()).toEqual(["Kelas 12.", "Ikut SNBT 2027."]);
    expect(await f.turn()).toMatchObject({
      remembered: 2,
      usage: [
        {
          agent: "memory",
          calls: 1,
          input: 12,
          model: expect.any(String),
          output: 4,
          provider: expect.any(String),
        },
      ],
    });
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    for (const shown of [
      MESSAGE,
      "# Today",
      "2026-10-10",
      "Account: none",
      "# Known Memories",
      "None",
    ]) {
      expect(prompt).toContain(shown);
    }
    expect(MutableRef.get(f.logged)).toEqual([]);
  });

  it("shows the model the memories it knows and lets it rewrite one by its id", async () => {
    const f = await fixture();
    answers(level);
    await f.capture();
    const [stored] = await f.stored();
    const model = answers({
      ...level,
      known: stored?._id ?? "missing",
      text: "Kelas 12 IPA.",
    });
    await f.capture();
    expect(encodeJsonText(model.doGenerateCalls[0]?.prompt)).toContain(
      `- [${stored?._id}] (level) Kelas 12.`
    );
    expect(await f.texts()).toEqual(["Kelas 12 IPA."]);
    expect(await f.stored()).toHaveLength(1);
  });

  it("saves nothing when the learner removes a memory while the model reads the message", async () => {
    const f = await fixture();
    const id = await f.seed({ kind: "level", text: "Kelas 11." });
    answersAfter(() => f.owner.mutation(remove, { id }), {
      ...level,
      known: id,
    });
    await f.capture();
    expect(await f.stored()).toEqual([]);
    expect((await f.turn())?.remembered).toBeUndefined();
    expect((await f.turn())?.usage).toEqual([
      expect.objectContaining({ agent: "memory", calls: 1 }),
    ]);
  });

  it("shows the model a memory the learner wrote as its words alone, and gives it the kind the model names", async () => {
    const f = await fixture();
    const id = await f.seed({ author: "learner", text: "Kelas 12 IPA" });
    const model = answers({ ...level, known: id, text: "Kelas 12 IPA." });
    await f.capture();
    expect(encodeJsonText(model.doGenerateCalls[0]?.prompt)).toContain(
      `- [${id}] Kelas 12 IPA`
    );
    // The words stay the learner's, and the memory takes the kind.
    expect(await f.texts()).toEqual(["Kelas 12 IPA"]);
    expect(await f.stored()).toEqual([
      expect.objectContaining({ author: "learner", kind: "level" }),
    ]);
  });

  it("shows the model a memory with its title and its first 240 characters, and keeps what the learner wrote when the model names it and says something else", async () => {
    const f = await fixture();
    const id = await f.seed({
      author: "learner",
      text: `Kelas 11.${"x".repeat(1991)}`,
      title: "Sekolah",
    });
    const [before] = await f.stored();
    const model = answers({ ...level, known: id, text: "Kelas 12 IPA." });
    await f.capture();
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    // The title with its colon and the first words take 18 of the 240.
    expect(prompt).toContain(
      `- [${id}] Sekolah: Kelas 11.${"x".repeat(222)}...`
    );
    expect(prompt).not.toContain("x".repeat(223));
    const [learners, written] = await f.stored();
    // `toStrictEqual` compares the sealed bytes; `toEqual` takes any two buffers for equal.
    expect(learners).toStrictEqual(before);
    expect(written).toMatchObject({ author: "nina", kind: "level" });
  });

  it("keeps the words the learner edits while the model reads the message, and gives the memory no kind", async () => {
    const f = await fixture();
    const id = await f.seed({ author: "learner", text: "Kelas 11." });
    answersAfter(() => f.owner.mutation(edit, { id, text: "Kelas 12 SMA" }), {
      ...level,
      known: id,
      text: "Kelas 12 SMA.",
    });
    await f.capture();
    expect(await f.texts()).toEqual(["Kelas 12 SMA"]);
    const [row] = await f.stored();
    expect(row).toMatchObject({ author: "learner" });
    expect(row).not.toHaveProperty("kind");
  });

  it("saves a situation with the end of its last day and links a memory to the open lesson", async () => {
    const f = await fixture("Ujian kimiaku tanggal 20 Oktober 2026.");
    await f.openLesson(`asset:en:${LESSON}`);
    answers({
      kind: "situation",
      quote: "ujian kimiaku",
      text: "Ujian kimia 20 Oktober.",
      until: "2026-10-20",
    });
    await f.capture();
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        kind: "situation",
        lesson: LESSON,
        validUntil: Date.UTC(2026, 9, 20, 23, 59, 59, 999),
      }),
    ]);
  });

  it.each([
    ["is 280 characters long", "x".repeat(280), true],
    ["is 281 characters long", "x".repeat(281), false],
    ["is empty", "", false],
    ["holds only spaces", "   ", false],
  ])("checks a sentence that %s", async (_, text, fits) => {
    // The test names the numbers, not the constant. A sentence that does not fit
    // refuses the whole answer.
    const f = await fixture();
    await f.seed({ author: "learner", text: "Sudah ada" });
    answers(level, { kind: "goal", quote: "mau ikut SNBT 2027", text });
    await f.capture();
    expect(await f.texts()).toEqual(
      fits ? ["Sudah ada", "Kelas 12.", text] : ["Sudah ada"]
    );
    expect(MutableRef.get(f.logged)).toEqual(
      fits ? [] : unavailable({ operation: "generate", rejected: true })
    );
  });

  it("saves nothing the learner's words do not support, but still counts the call", async () => {
    const f = await fixture();
    answers(
      { ...level, quote: "Aku kelas 11" },
      { ...level, text: "Kontak: nama@contoh.com" },
      {
        kind: "situation",
        quote: "kelas 12",
        text: "Ujian yang sudah lewat.",
        until: "2026-10-09",
      }
    );
    await f.capture();
    expect(await f.stored()).toEqual([]);
    expect((await f.turn())?.remembered).toBeUndefined();
    expect((await f.turn())?.usage).toEqual([
      expect.objectContaining({ agent: "memory", calls: 1 }),
    ]);
    expect(MutableRef.get(f.logged)).toEqual([]);
  });
});

describe("memory capture that fails", () => {
  it("logs the provider's routing facts, never its words, and saves nothing", async () => {
    const f = await fixture();
    fails(() =>
      Promise.reject(
        new APICallError({
          message: "Private provider detail",
          requestBodyValues: { prompt: MESSAGE },
          statusCode: 400,
          isRetryable: false,
          url: "https://ai-gateway.convex.dev/v1/chat/completions",
        })
      )
    );
    await f.capture();
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({
        operation: "generate",
        reason: "invalid",
        rejected: false,
        status: 400,
      })
    );
    expect(encodeJsonText(MutableRef.get(f.logged))).not.toContain(
      "Private provider detail"
    );
    expect(encodeJsonText(MutableRef.get(f.logged))).not.toContain("Aku");
    expect(await f.stored()).toEqual([]);
  });

  it("logs an answer that is not the asked object as rejected", async () => {
    const f = await fixture();
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: providerStep([{ type: "text", text: "not an object" }]),
      })
    );
    await f.capture();
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "generate", rejected: true })
    );
    expect(await f.stored()).toEqual([]);
  });

  it("logs a prompt it cannot read", async () => {
    const f = await fixture();
    const model = answers(level);
    await f.capture("not-a-message-id");
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "read", rejected: false })
    );
  });

  it("logs a write that dies and saves nothing", async () => {
    const f = await fixture();
    answers(level);
    vi.stubEnv("VAULT_ROOT_KEYS", "");
    await f.capture();
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "unknown", rejected: false })
    );
    expect(await f.stored()).toEqual([]);
  });

  it("logs a memory it cannot open and changes nothing", async () => {
    const f = await fixture();
    const model = answers(level);
    await f.seed({ author: "learner" });
    await f.t.mutation(async (ctx) => {
      for (const key of await ctx.db.query("vaultKeys").collect()) {
        await ctx.db.delete(key._id);
      }
    });
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "unknown", rejected: false })
    );
    expect(await f.stored()).toHaveLength(1);
  });
});

describe("memory capture among the follow-up work of a turn", () => {
  /**
   * A model for a whole turn: it answers the capture call with `level` and
   * answers the suggestions and the title as `ninaModel` does.
   */
  function turnModel() {
    const model = ninaModel();
    const generate = vi.fn<MockLanguageModelV4["doGenerate"]>(
      ({ prompt, responseFormat }) => {
        let text = "Understanding A Function Limit";
        if (encodeJsonText(prompt).includes("# Learner Message")) {
          text = encodeJsonText({ memories: [level] });
        } else if (responseFormat?.type === "json") {
          text = encodeJsonText({
            suggestions: ["How does this relate to continuity?"],
          });
        }
        return Promise.resolve(providerStep([{ type: "text", text }]));
      }
    );
    model.doGenerate = generate;
    provider.languageModel.mockReturnValue(model);
    return generate;
  }

  it("saves the memory beside the suggestions and the title", async () => {
    const f = await fixture();
    const generate = turnModel();
    await f.t.action(run, { turnId: f.turnId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    expect(generate).toHaveBeenCalledTimes(3);
    expect(await f.turn()).toMatchObject({
      remembered: 1,
      state: { status: "complete" },
      suggestions: ["How does this relate to continuity?"],
    });
    expect(await f.texts()).toEqual(["Kelas 12."]);
    expect(
      (await f.t.query((ctx) => ctx.db.get("chats", f.chatId)))?.title
    ).toBe("Understanding A Function Limit");
  });

  it("never costs the turn its suggestions or its title when the memory write dies", async () => {
    const f = await fixture();
    const generate = turnModel();
    vi.stubEnv("VAULT_ROOT_KEYS", "");
    await f.t.action(run, { turnId: f.turnId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    expect(generate).toHaveBeenCalledTimes(3);
    expect(await f.turn()).toMatchObject({
      state: { status: "complete" },
      suggestions: ["How does this relate to continuity?"],
    });
    expect(
      (await f.t.query((ctx) => ctx.db.get("chats", f.chatId)))?.title
    ).toBe("Understanding A Function Limit");
    expect(await f.stored()).toEqual([]);
  });
});
