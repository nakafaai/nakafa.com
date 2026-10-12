import { Ref } from "@confect/core";
import { saveMessage } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { noteText } from "@repo/backend/confect/nina/judgment/note";
import { askedOf, provider, textOf } from "@repo/backend/test/gateway";
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
import {
  Array as Arr,
  MutableRef,
  Order,
  Record as Rec,
  String as Str,
} from "effect";

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

/** The lines of a prompt that list a known memory, one line each. */
function lines(prompt: string) {
  return Arr.filter(Str.split(prompt, "\\n"), Str.startsWith("- ["));
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

  it("asks the capture model about a message in a script without spaces, because the decision model reads every language, and sends that decision the message alone", async () => {
    const message =
      "高校三年生で、来年は東京大学を目指しています。確率が苦手です。";
    const f = await createCapturingTest(message);
    const model = answers({
      kind: "level",
      quote: "高校三年生",
      text: "高校三年生。",
    });
    const { requests } = judges();
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(await f.texts()).toEqual(["高校三年生。"]);
    expect((await f.turn())?.remembered).toBe(1);
    // The first request judged the message, the second judged the candidate.
    expect(Arr.map(requests(), (request) => request.state)).toEqual([
      [{ text: message, type: "text" }],
      [{ text: "Note: 高校三年生。\nQuote: 高校三年生", type: "text" }],
    ]);
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

  it("reads the pause once before any model, and saves nothing when the learner pauses memory while the models read, because the write reads it again as the authority", async () => {
    const f = await createCapturingTest();
    const model = answers(level);
    provider.decisionModel.mockReturnValue(
      new DecisionMockModel({
        doDecide: async ({ questions }) => {
          await f.owner.mutation(pause, { paused: true });
          return {
            // Lasting and the learner's own note, and nothing private.
            answers: Rec.map(questions, (_, id) => ({
              probability: Str.startsWith("private")(id) ? 0.01 : 0.99,
              type: "boolean" as const,
            })),
            warnings: [],
          };
        },
      })
    );
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(await f.stored()).toEqual([]);
    expect((await f.turn())?.remembered).toBeUndefined();
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

  it("shows the model the memories it knows by their place on the list and lets it restate one by its number", async () => {
    const f = await createCapturingTest();
    answers(level);
    await f.capture();
    const model = answers({ ...level, known: 1, text: "Kelas 12 IPA." });
    await f.capture();
    expect(encodeJsonText(model.doGenerateCalls[0]?.prompt)).toContain(
      "- [1] (level) Kelas 12."
    );
    expect(await f.texts()).toEqual(["Kelas 12 IPA."]);
    expect(await f.stored()).toHaveLength(1);
  });

  it("shows the model the twelve memories that match the message best, the best first and numbered, not every memory", async () => {
    const f = await createCapturingTest();
    const said = (index: number) => `Aku belajar kelas ${index.toString(36)}`;
    for (const index of Arr.range(0, 29)) {
      await f.seed({
        author: "learner",
        confirmedAt: index + 1,
        text: said(index),
      });
    }
    await f.seed({ confirmedAt: 99, text: "Hobi saya main gitar" });
    const model = answers(level);
    await f.capture();
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    // The newest twelve of the thirty that hold a word of the message, the
    // newest first: the hobby holds none.
    expect(lines(prompt)).toEqual(
      Arr.makeBy(12, (place) => `- [${place + 1}] ${said(29 - place)}`)
    );
  });

  it("shows the model the memory linked to the open page, though its words match nothing", async () => {
    const f = await createCapturingTest();
    await f.openLesson(`asset:en:${LESSON}`, SLUG);
    await f.seed({
      text: "Hobi saya main gitar",
      topics: [`lesson:${LESSON}`],
    });
    const model = answers(level);
    await f.capture();
    expect(encodeJsonText(model.doGenerateCalls[0]?.prompt)).toContain(
      "- [1] (goal) Hobi saya main gitar"
    );
  });

  it("cuts the list of known memories at its token budget, says that others are left out, and lets no number name one the model could not read", async () => {
    const f = await createCapturingTest();
    // Twelve memories of 236 rare characters each are more than the model reads.
    const rare = Arr.join(
      Arr.makeBy(230, (index) => String.fromCodePoint(0x4e_00 + index * 7)),
      ""
    );
    await f.fill(12, { author: "learner", text: `kelas ${rare}` });
    // The model names the twelfth place, which the cut list does not reach.
    const model = answers({ ...level, known: 12 });
    await f.capture();
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Other memories are not listed.");
    expect(Arr.length(lines(prompt))).toBeLessThan(12);
    // It names nothing, so the candidate is a new memory and no memory is confirmed.
    expect(await f.stored()).toHaveLength(13);
    expect(Arr.map(await f.stored(), (row) => row.confirmedAt)).toEqual([
      ...Arr.makeBy(12, (index) => index + 1),
      NOW,
    ]);
  });

  it("saves nothing when the learner removes a memory while the model reads the message", async () => {
    const f = await createCapturingTest();
    const id = await f.seed({ kind: "level", text: "Kelas 11." });
    answersAfter(() => f.owner.mutation(remove, { id }), {
      ...level,
      known: 1,
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

  it("shows the model a memory with its title and its first 240 characters, and keeps the words of a memory the learner wrote when the model names it", async () => {
    const f = await createCapturingTest();
    await f.seed({
      author: "learner",
      text: `Kelas 11.${"x".repeat(1991)}`,
      title: "Sekolah",
    });
    const [before] = await f.stored();
    const model = answers({ ...level, known: 1, text: "Kelas 12 IPA." });
    await f.capture();
    const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
    // The title with its colon and the first words take 18 of the 240.
    expect(prompt).toContain(`- [1] Sekolah: Kelas 11.${"x".repeat(222)}...`);
    expect(prompt).not.toContain("x".repeat(223));
    const [after, ...others] = await f.stored();
    expect(others).toEqual([]);
    // The model said the new sentence restates the memory, so the memory is
    // confirmed and keeps its words. `toStrictEqual` compares the sealed bytes;
    // `toEqual` takes any two buffers for equal.
    expect(after).toMatchObject({ author: "learner", confirmedAt: NOW });
    expect(after?.text).toStrictEqual(before?.text);
    expect(after?.title).toStrictEqual(before?.title);
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
    const contact = { ...level, text: "Kontak: nama@contoh.com" };
    answers({ ...level, quote: "Aku kelas 11" }, contact, {
      kind: "situation",
      quote: "kelas 12",
      text: "Ujian yang sudah lewat.",
      until: "2026-10-09",
    });
    // Only the second candidate passes the structure checks, so it is the one the decision model judges.
    judges({ privates: [contact] });
    await f.capture();
    expect(await f.stored()).toEqual([]);
    expect((await f.turn())?.remembered).toBeUndefined();
    expect((await f.turn())?.usage).toEqual([
      expect.objectContaining({ agent: "memory", calls: 1 }),
    ]);
    expect(MutableRef.get(f.logged)).toEqual([]);
  });

  it("drops a candidate in which the decision model finds something private and keeps the clean one beside it, with a decision request for each candidate", async () => {
    const f = await createCapturingTest(
      "Aku kelas 12 dan nomor teleponku 0812 3456 7890."
    );
    const phone = {
      kind: "goal",
      quote: "nomor teleponku 0812 3456 7890",
      text: "Nomor telepon 0812 3456 7890.",
    } as const;
    answers(level, phone);
    const { requests } = judges({ privates: [phone] });
    await f.capture();
    expect(await f.texts()).toEqual(["Kelas 12."]);
    expect((await f.turn())?.remembered).toBe(1);
    // One request judged the message. Then each candidate had a request of
    // its own, as its sentence and its quote, which run at the same time.
    const [message, ...candidates] = requests();
    expect(message?.state).toEqual([
      {
        text: "Aku kelas 12 dan nomor teleponku 0812 3456 7890.",
        type: "text",
      },
    ]);
    expect(message && askedOf(message)).toEqual(["lasting"]);
    expect(Arr.sort(Arr.map(candidates, textOf), Order.String)).toEqual(
      Arr.sort([noteText(level), noteText(phone)], Order.String)
    );
    // Both judgments of a candidate were asked in its one request.
    for (const candidate of candidates) {
      expect(askedOf(candidate)).toEqual(["ownNote", "private"]);
    }
    expect(MutableRef.get(f.logged)).toEqual([]);
  });

  it("drops a candidate that the decision model finds is not the learner's own note and keeps the clean one beside it, in any language", async () => {
    const f = await createCapturingTest(
      "高校三年生で、確率が苦手です。来年は東京大学を目指しています。"
    );
    const outside = {
      kind: "level",
      quote: "高校三年生",
      text: "学習者は高校三年生です。",
    } as const;
    answers(outside, {
      kind: "struggle",
      quote: "確率が苦手です",
      text: "確率が苦手です。",
    });
    judges({ notOwn: [outside] });
    await f.capture();
    expect(await f.texts()).toEqual(["確率が苦手です。"]);
    expect((await f.turn())?.remembered).toBe(1);
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
  it("saves the fact of a message and drops the sentences that the decision model finds describe the learner from outside, whatever their words", async () => {
    const f = await createCapturingTest(
      "Aku kelas 12 IPA dan lebih suka belajar dengan contoh soal dulu sebelum rumus."
    );
    const quote = "aku kelas 12 ipa";
    const learner = {
      kind: "level",
      quote,
      text: "Learner berada di kelas 12 IPA.",
    } as const;
    const student = {
      kind: "level",
      quote,
      text: "Siswa kelas 12 IPA.",
    } as const;
    answers(learner, student, {
      kind: "level",
      quote,
      text: "Kelas 12 IPA.",
    });
    // The verdicts are the model's alone: no word of a sentence decides them.
    judges({ notOwn: [learner, student] });
    await f.capture();
    expect(await f.texts()).toEqual(["Kelas 12 IPA."]);
    expect(MutableRef.get(f.logged)).toEqual([]);
  });

  it("keeps a sentence that starts with a word that names the learner when the decision model finds it is the learner's own note", async () => {
    const f = await createCapturingTest(
      "User experience design is hard for me."
    );
    answers({
      kind: "struggle",
      quote: "User experience design is hard",
      text: "User experience design is hard.",
    });
    await f.capture();
    expect(await f.texts()).toEqual(["User experience design is hard."]);
  });
});
