import { Ref } from "@confect/core";
import { saveMessage } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import type { NinaMemoryCandidate } from "@repo/backend/confect/nina/memory.spec";
import { provider } from "@repo/backend/test/gateway";
import {
  answers,
  answersAfter,
  createCapturingTest,
  fails,
  level,
  MESSAGE,
} from "@repo/backend/test/nina/capture";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, MutableRef, String as Str } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const NOW = Date.UTC(2026, 9, 10, 12);
const LESSON = "material:lesson:mathematics:material-section:limits";
const SLUG = "subjects/mathematics/limits/concept";
const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);
const remove = Ref.getFunctionReference(refs.public.nina.memory.remove);

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

/** The log entry of a capture that saved nothing. */
const unavailable = (fact: object) => [
  ["Nina memory unavailable", expect.objectContaining(fact)],
];

/** How many known memories a prompt lists, one line each. */
function listed(prompt: string) {
  return Arr.length(
    Arr.filter(Str.split(prompt, "\\n"), Str.startsWith("- ["))
  );
}

describe("memory capture", () => {
  it("asks no model about a message that says nothing about the learner", async () => {
    const f = await createCapturingTest("Explain a limit.");
    const model = answers(level);
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.stored()).toEqual([]);
    expect((await f.turn())?.usage).toEqual([]);
  });

  it("asks no model about a prompt that holds no words of the learner", async () => {
    const f = await createCapturingTest();
    const model = answers(level);
    // Nina's own reply says the words that pass the gate, which are not the learner's.
    const answer = await f.t.mutation((ctx) =>
      saveMessage(ctx, components.nina, {
        threadId: f.threadId,
        message: { role: "assistant", content: MESSAGE },
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
    expect(await f.stored()).toEqual([]);
    expect(MutableRef.get(f.logged)).toEqual([]);
  });

  it("asks no model while memory is paused", async () => {
    const f = await createCapturingTest();
    const model = answers(level);
    await f.owner.mutation(pause, { paused: true });
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.stored()).toEqual([]);
  });

  it("saves what the learner said about themself, at most three memories, and records the call under the memory agent", async () => {
    const f = await createCapturingTest();
    const model = answers(
      level,
      { kind: "goal", quote: "mau ikut SNBT 2027", text: "Ikut SNBT 2027." },
      { kind: "style", quote: "SNBT 2027", text: "Siap SNBT 2027." }
    );
    await f.capture();
    expect(await f.texts()).toEqual([
      "Kelas 12.",
      "Ikut SNBT 2027.",
      "Siap SNBT 2027.",
    ]);
    expect(await f.turn()).toMatchObject({
      remembered: 3,
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
    expect(prompt).toContain(MESSAGE);
    expect(prompt).toContain("# Today\\n\\n2026-10-10");
    expect(prompt).toContain("Account: none");
    expect(prompt).toContain("# Known Memories\\n\\nNone");
    expect(MutableRef.get(f.logged)).toEqual([]);
  });

  it("shows the model the memories it knows and lets it rewrite one by its id", async () => {
    const f = await createCapturingTest();
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

  it("shows the model the twelve memories that match the message best, not every memory", async () => {
    const f = await createCapturingTest();
    await f.fill(30, {
      author: "learner",
      text: "Aku belajar kelas dua belas",
    });
    await f.seed({ confirmedAt: 99, text: "Hobi saya main gitar" });
    const [hobby, ...newest] = Arr.reverse(await f.stored());
    const model = answers(level);
    await f.capture();
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    // The newest twelve of the thirty that hold a word of the message.
    expect(listed(prompt)).toBe(12);
    for (const row of Arr.take(newest, 12)) {
      expect(prompt).toContain(`- [${row._id}]`);
    }
    expect(prompt).not.toContain(`- [${newest[12]?._id}]`);
    expect(prompt).not.toContain(`- [${hobby?._id}]`);
  });

  it("shows the model the memory linked to the open page, though its words match nothing", async () => {
    const f = await createCapturingTest();
    await f.openLesson(`asset:en:${LESSON}`, SLUG);
    const id = await f.seed({
      text: "Hobi saya main gitar",
      topics: [`lesson:${LESSON}`],
    });
    const model = answers(level);
    await f.capture();
    expect(encodeJsonText(model.doGenerateCalls[0]?.prompt)).toContain(
      `- [${id}] (goal) Hobi saya main gitar`
    );
  });

  it("cuts the list of known memories at its token budget and says that others are left out", async () => {
    const f = await createCapturingTest();
    // Twelve memories of 236 rare characters each are more than the model reads.
    const rare = Arr.join(
      Arr.makeBy(230, (index) => String.fromCodePoint(0x4e_00 + index * 7)),
      ""
    );
    await f.fill(12, { author: "learner", text: `kelas ${rare}` });
    const model = answers(level);
    await f.capture();
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Other memories are not listed.");
    expect(listed(prompt)).toBeLessThan(12);
  });

  it("saves nothing when the learner removes a memory while the model reads the message", async () => {
    const f = await createCapturingTest();
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

  it("saves while the learner removes a memory that was not shown to the model, because the call read only the twelve it showed", async () => {
    const f = await createCapturingTest();
    await f.fill(14, {
      author: "learner",
      text: "Aku belajar kelas dua belas",
    });
    // The two oldest of fourteen are not among the twelve shown.
    const [oldest] = await f.stored();
    answersAfter(
      () => f.owner.mutation(remove, { id: oldest?._id ?? "missing" }),
      level
    );
    await f.capture();
    expect((await f.turn())?.remembered).toBe(1);
    expect(await f.stored()).toHaveLength(14);
  });

  it("shows the model a memory with its title and its first 240 characters, and keeps what the learner wrote when the model names it and says something else", async () => {
    const f = await createCapturingTest();
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

  it("saves a situation with the end of its last day and links a memory to the lesson and the paths of the open page", async () => {
    const f = await createCapturingTest(
      "Ujian kimiaku tanggal 20 Oktober 2026."
    );
    await f.openLesson(`asset:en:${LESSON}`, SLUG);
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
        topics: [
          `lesson:${LESSON}`,
          "path:subjects/mathematics/limits",
          "path:subjects/mathematics",
        ],
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
    const f = await createCapturingTest();
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
    const f = await createCapturingTest();
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

describe("memory capture wording", () => {
  /** Three candidates that quote the same words of the learner. */
  const candidates = (
    quote: string,
    ...texts: readonly [string, string, string]
  ) =>
    Arr.map(texts, (text): typeof NinaMemoryCandidate.Type => ({
      kind: "level",
      quote,
      text,
    }));

  it.each([
    [
      "Indonesian",
      "Aku kelas 12 IPA dan lebih suka belajar dengan contoh soal dulu sebelum rumus.",
      "aku kelas 12 ipa",
      [
        "Learner berada di kelas 12 IPA.",
        "Siswa lebih suka contoh soal dulu sebelum rumus.",
        "Kelas 12 IPA.",
      ],
    ],
    [
      "English",
      "I'm in grade 12 and I prefer worked examples before formulas.",
      "i'm in grade 12",
      [
        "The learner is in grade 12.",
        "Student prefers worked examples before formulas.",
        "In grade 12.",
      ],
    ],
    [
      "German",
      "Ich bin in Klasse 12 und lerne lieber erst mit Beispielaufgaben.",
      "ich bin in klasse 12",
      [
        "Der Lernende ist in Klasse 12.",
        "Schüler lernt lieber erst mit Beispielaufgaben.",
        "Klasse 12.",
      ],
    ],
  ] as const)(
    "saves the fact of an %s message and drops the sentences that label the learner",
    async (_language, message, quote, [first, second, clean]) => {
      const f = await createCapturingTest(message);
      answers(...candidates(quote, first, second, clean));
      await f.capture();
      expect(await f.texts()).toEqual([clean]);
      expect(MutableRef.get(f.logged)).toEqual([]);
    }
  );
});

describe("memory capture that fails", () => {
  it("logs the provider's routing facts, never its words, and saves nothing", async () => {
    const f = await createCapturingTest();
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

  it("logs an answer with more than three memories as rejected, and saves none of them", async () => {
    const f = await createCapturingTest();
    answers(level, level, level, level);
    await f.capture();
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "generate", rejected: true })
    );
    expect(await f.stored()).toEqual([]);
  });

  it("logs an answer that is not the asked object as rejected", async () => {
    const f = await createCapturingTest();
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
    const f = await createCapturingTest();
    const model = answers(level);
    await f.capture("not-a-message-id");
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "read", rejected: false })
    );
  });

  it("logs a write that dies and saves nothing", async () => {
    const f = await createCapturingTest();
    answers(level);
    vi.stubEnv("VAULT_ROOT_KEYS", "");
    await f.capture();
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "unknown", rejected: false })
    );
    expect(await f.stored()).toEqual([]);
  });

  it("logs a memory it cannot open and changes nothing", async () => {
    const f = await createCapturingTest();
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
