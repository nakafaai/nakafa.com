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
  judges,
  level,
  MESSAGE,
  unavailable,
} from "@repo/backend/test/nina/capture";
import { encodeJsonText } from "@repo/utilities/json";
import { Experimental_DecisionMockModelV4 as DecisionMockModel } from "ai/test";
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
  provider.decisionModel.mockReset();
  provider.languageModel.mockReset();
});

/** How many known memories a prompt lists, one line each. */
function listed(prompt: string) {
  return Arr.length(
    Arr.filter(Str.split(prompt, "\\n"), Str.startsWith("- ["))
  );
}

describe("memory capture", () => {
  it("asks the capture model nothing about a message in which the decision model finds nothing lasting, and sends that decision the message alone", async () => {
    const f = await createCapturingTest("Explain a limit.");
    const model = answers(level);
    const { requests } = judges({ lasting: false });
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.stored()).toEqual([]);
    expect((await f.turn())?.usage).toEqual([]);
    expect(Arr.map(requests(), (request) => request.state)).toEqual([
      [{ text: "Explain a limit.", type: "text" }],
    ]);
    expect(MutableRef.get(f.logged)).toEqual([]);
  });

  it("asks the capture model about a message in a script without spaces, because the decision model reads every language", async () => {
    const f = await createCapturingTest(
      "高校三年生で、来年は東京大学を目指しています。確率が苦手です。"
    );
    const model = answers({
      kind: "level",
      quote: "高校三年生",
      text: "高校三年生。",
    });
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(await f.texts()).toEqual(["高校三年生。"]);
    expect((await f.turn())?.remembered).toBe(1);
  });

  it("asks no model about a prompt that holds no words of the learner", async () => {
    const f = await createCapturingTest();
    const model = answers(level);
    // Nina's own reply says the words that hold a memory, which are not the learner's.
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

  it("asks no model while memory is paused, the decision model included, so a paused learner's message goes nowhere", async () => {
    const f = await createCapturingTest();
    const model = answers(level);
    const { requests } = judges();
    await f.owner.mutation(pause, { paused: true });
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(requests()).toEqual([]);
    expect(await f.stored()).toEqual([]);
  });

  it("asks the capture model nothing when the learner pauses memory while the decision is made", async () => {
    const f = await createCapturingTest();
    const model = answers(level);
    provider.decisionModel.mockReturnValue(
      new DecisionMockModel({
        doDecide: async () => {
          await f.owner.mutation(pause, { paused: true });
          return {
            answers: { "lasting.0": { probability: 0.99, type: "boolean" } },
            warnings: [],
          };
        },
      })
    );
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.stored()).toEqual([]);
    expect(MutableRef.get(f.logged)).toEqual([]);
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

  it("saves nothing the learner's words do not support, or in which the decision model finds something private, but still counts the call", async () => {
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
    // Only the second candidate passes the structure checks, so it is the one the decision model judges.
    judges({ privates: [true] });
    await f.capture();
    expect(await f.stored()).toEqual([]);
    expect((await f.turn())?.remembered).toBeUndefined();
    expect((await f.turn())?.usage).toEqual([
      expect.objectContaining({ agent: "memory", calls: 1 }),
    ]);
    expect(MutableRef.get(f.logged)).toEqual([]);
  });

  it("drops a candidate in which the decision model finds something private and keeps the clean one beside it, from one decision request", async () => {
    const f = await createCapturingTest(
      "Aku kelas 12 dan nomor teleponku 0812 3456 7890."
    );
    answers(level, {
      kind: "goal",
      quote: "nomor teleponku 0812 3456 7890",
      text: "Nomor telepon 0812 3456 7890.",
    });
    const { requests } = judges({ privates: [false, true] });
    await f.capture();
    expect(await f.texts()).toEqual(["Kelas 12."]);
    expect((await f.turn())?.remembered).toBe(1);
    // One request judged the message, one judged both candidates together, each as its sentence and its quote.
    expect(Arr.map(requests(), (request) => request.state)).toEqual([
      [
        {
          text: "Aku kelas 12 dan nomor teleponku 0812 3456 7890.",
          type: "text",
        },
      ],
      [
        { text: "Text 1:\nKelas 12.\nAku kelas 12", type: "text" },
        {
          text: "Text 2:\nNomor telepon 0812 3456 7890.\nnomor teleponku 0812 3456 7890",
          type: "text",
        },
      ],
    ]);
    expect(MutableRef.get(f.logged)).toEqual([]);
  });

  it("asks the decision model about no candidate when none passes the structure checks", async () => {
    const f = await createCapturingTest();
    answers({ ...level, quote: "Aku kelas 11" });
    const { requests } = judges();
    await f.capture();
    expect(requests()).toHaveLength(1);
    expect(await f.stored()).toEqual([]);
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

  it("tells the model to state the fact without naming the learner, with a good and a bad example in each language", async () => {
    const f = await createCapturingTest();
    const model = answers();
    await f.capture();
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    for (const said of [
      "never start with a word that names them",
      "'Kelas 12 IPA.'",
      "'In grade 12.'",
      "'Klasse 12, naturwissenschaftlicher Zweig.'",
      "Bad: 'Learner berada di kelas 12 IPA.'",
    ]) {
      expect(prompt).toContain(said);
    }
  });
});
