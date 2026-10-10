import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { SOURCE_LIMIT } from "@repo/backend/confect/nina/memory/store";
import {
  MEMORY_LIMIT,
  type NinaMemoryCandidate,
} from "@repo/backend/confect/nina/memory.spec";
import { createMemoryTest } from "@repo/backend/test/nina/memory";

const capture = Ref.getFunctionReference(refs.internal.nina.memory.capture);
const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);

const NOW = Date.UTC(2026, 9, 10, 12);
const LESSON = "material:lesson:mathematics:material-section:limits";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** A candidate that states a level, with any field replaced. */
function candidate(
  fields: Partial<typeof NinaMemoryCandidate.Type> = {}
): typeof NinaMemoryCandidate.Type {
  return {
    kind: "level",
    quote: "aku kelas 12",
    text: "Kelas 12 IPA.",
    ...fields,
  };
}

/** A learner with a chat and a turn, and a way to run one capture for them. */
async function fixture() {
  const f = await createMemoryTest();
  const run = (
    candidates: (typeof NinaMemoryCandidate.Type)[],
    {
      chatId = f.chatId,
      lesson,
    }: { chatId?: typeof f.chatId; lesson?: string } = {}
  ) =>
    f.t.mutation(capture, {
      candidates,
      chatId,
      ...(lesson === undefined ? {} : { lesson }),
      turnId: f.turnId,
      userId: f.identity.userId,
    });
  const remembered = async () =>
    (await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId)))?.remembered;
  return { ...f, remembered, run };
}

describe("memory capture write", () => {
  it("writes a new memory as Nina's own, sealed, with the lesson and the chat as its source", async () => {
    const f = await fixture();
    expect(await f.run([candidate()], { lesson: LESSON })).toBe(1);
    const [row] = await f.stored();
    expect(row).toMatchObject({
      author: "nina",
      confirmedAt: NOW,
      kind: "level",
      lesson: LESSON,
      userId: f.identity.userId,
    });
    expect(row?.validUntil).toBeUndefined();
    expect(new TextDecoder("latin1").decode(row?.text)).not.toContain("Kelas");
    expect(await f.texts()).toEqual(["Kelas 12 IPA."]);
    expect(await f.sources()).toEqual([
      expect.objectContaining({
        chatId: f.chatId,
        memoryId: row?._id,
        userId: f.identity.userId,
      }),
    ]);
    expect(await f.remembered()).toBe(1);
  });

  it("gives a situation the end of its last day and drops one without a usable date", async () => {
    const f = await fixture();
    const situation = candidate({
      kind: "situation",
      quote: "ulangan kimia",
      text: "Ulangan kimia.",
    });
    expect(
      await f.run([
        situation,
        { ...situation, until: "20 Oktober" },
        { ...situation, until: "2026-10-20" },
      ])
    ).toBe(1);
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        kind: "situation",
        validUntil: Date.UTC(2026, 9, 20, 23, 59, 59, 999),
      }),
    ]);
  });

  it("moves the end of a situation that the learner says again with a new day", async () => {
    const f = await fixture();
    const id = await f.seed({
      kind: "situation",
      text: "Ulangan kimia",
      validUntil: Date.UTC(2026, 9, 12, 23, 59, 59, 999),
    });
    expect(
      await f.run([
        candidate({
          kind: "situation",
          known: id,
          text: "Ulangan kimia diundur",
          until: "2026-10-25",
        }),
      ])
    ).toBe(1);
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        _id: id,
        validUntil: Date.UTC(2026, 9, 25, 23, 59, 59, 999),
      }),
    ]);
    expect(await f.texts()).toEqual(["Ulangan kimia diundur"]);
  });

  it("writes no lesson when the learner had none open", async () => {
    const f = await fixture();
    await f.run([candidate()]);
    expect((await f.stored())[0]?.lesson).toBeUndefined();
  });

  it("rewrites the known memory, keeps its author, its lesson and its place, and counts a chat once", async () => {
    const f = await fixture();
    const second = await f.chat();
    const id = await f.seed({
      author: "learner",
      confirmedAt: 1,
      kind: "level",
      lesson: "material:lesson:chemistry",
      text: "Kelas 11.",
    });
    expect(await f.run([candidate({ known: id })], { lesson: LESSON })).toBe(1);
    expect(await f.run([candidate({ known: id })])).toBe(1);
    expect(await f.sources()).toHaveLength(1);
    expect(await f.run([candidate({ known: id })], { chatId: second })).toBe(1);
    expect(await f.sources()).toHaveLength(2);
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        author: "learner",
        confirmedAt: NOW,
        lesson: "material:lesson:chemistry",
      }),
    ]);
    expect(await f.texts()).toEqual(["Kelas 12 IPA."]);
    expect(await f.remembered()).toBe(1);
  });

  it("confirms a memory without sealing it again when its words are the same", async () => {
    const f = await fixture();
    const id = await f.seed({
      confirmedAt: 1,
      kind: "level",
      text: "Kelas 12 IPA.",
    });
    const [before] = await f.stored();
    expect(await f.run([candidate({ known: id })])).toBe(1);
    const [after] = await f.stored();
    expect(after?.confirmedAt).toBe(NOW);
    expect(after?.text).toEqual(before?.text);
  });

  it("confirms the memory of its kind that says the same, and none that says something else", async () => {
    const f = await fixture();
    const goal = await f.seed({
      confirmedAt: 1,
      kind: "goal",
      text: "Mau ikut SNBT 2027",
    });
    await f.seed({ confirmedAt: 1, kind: "goal", text: "Mau kuliah di ITB" });
    const wording = candidate({
      kind: "goal",
      quote: "mau ikut snbt 2027",
      text: "mau ikut SNBT 2027!",
    });
    expect(await f.run([wording])).toBe(1);
    expect(await f.stored()).toHaveLength(2);
    expect(await f.stored()).toContainEqual(
      expect.objectContaining({ _id: goal, confirmedAt: NOW })
    );
    expect(await f.texts()).toEqual([
      "mau ikut SNBT 2027!",
      "Mau kuliah di ITB",
    ]);
    expect(await f.run([{ ...wording, text: "Mau ikut UTBK pada 2027" }])).toBe(
      1
    );
    expect(await f.stored()).toHaveLength(3);
  });

  it("confirms a memory whose words share four fifths with the candidate's", async () => {
    const f = await fixture();
    await f.seed({
      kind: "level",
      text: "Saya kelas 12 IPA di SMA Negeri 1 Bandung",
    });
    expect(
      await f.run([
        candidate({
          text: "Saya kelas 12 IPA di SMA Negeri 1 Bandung sekarang",
        }),
      ])
    ).toBe(1);
    expect(await f.texts()).toEqual([
      "Saya kelas 12 IPA di SMA Negeri 1 Bandung sekarang",
    ]);
  });

  it("writes a new memory when the known memory is of another kind or another learner's", async () => {
    const f = await fixture();
    const other = await f.stranger();
    const goal = await f.seed({ kind: "goal", text: "Ikut SNBT" });
    const theirs = await f.seed({
      kind: "level",
      text: "Kelas 9",
      userId: other.userId,
    });
    expect(await f.run([candidate({ known: goal })])).toBe(1);
    expect(
      await f.run([candidate({ known: theirs, text: "Kelas 12 SMA." })])
    ).toBe(1);
    expect(await f.texts()).toEqual([
      "Ikut SNBT",
      "Kelas 12 IPA.",
      "Kelas 12 SMA.",
    ]);
    expect(await f.texts(other.userId)).toEqual(["Kelas 9"]);
  });

  it("folds candidates of one call that say the same into one memory", async () => {
    const f = await fixture();
    expect(
      await f.run([candidate(), candidate({ text: "kelas 12 ipa" })])
    ).toBe(1);
    expect(await f.stored()).toHaveLength(1);
    expect(await f.remembered()).toBe(1);
  });

  it("counts every memory it writes or confirms", async () => {
    const f = await fixture();
    expect(
      await f.run([
        candidate(),
        candidate({
          kind: "style",
          quote: "contoh soal",
          text: "Suka contoh soal.",
        }),
      ])
    ).toBe(2);
    expect(await f.remembered()).toBe(2);
  });

  it("keeps a source of a memory only up to the source limit", async () => {
    const f = await fixture();
    const id = await f.seed({
      author: "learner",
      kind: "level",
      text: "Kelas 12 IPA.",
    });
    for (let index = 0; index < SOURCE_LIMIT + 2; index += 1) {
      await f.run([candidate({ known: id })], { chatId: await f.chat() });
    }
    expect(await f.sources()).toHaveLength(SOURCE_LIMIT);
  });
});

describe("memory capture write at the limit", () => {
  it("drops the Nina-written memory confirmed longest ago, with its sources", async () => {
    const f = await fixture();
    await f.seed({ chats: [f.chatId], confirmedAt: 0, text: "Oldest" });
    await f.fill(MEMORY_LIMIT - 1);
    expect(await f.run([candidate()])).toBe(1);
    const texts = await f.texts();
    expect(texts).toHaveLength(MEMORY_LIMIT);
    expect(texts).not.toContain("Oldest");
    expect(texts).toContain("Kelas 12 IPA.");
    expect(await f.sources()).toEqual([
      expect.objectContaining({ chatId: f.chatId }),
    ]);
  });

  it("drops the new memory when the learner wrote every one", async () => {
    const f = await fixture();
    await f.fill(MEMORY_LIMIT, { author: "learner" });
    expect(await f.run([candidate()])).toBe(0);
    expect(await f.stored()).toHaveLength(MEMORY_LIMIT);
    expect(await f.texts()).not.toContain("Kelas 12 IPA.");
    expect(await f.remembered()).toBeUndefined();
  });
});

describe("memory capture write that changes nothing", () => {
  it("writes nothing while memory is paused", async () => {
    const f = await fixture();
    await f.owner.mutation(pause, { paused: true });
    expect(await f.run([candidate()])).toBe(0);
    expect(await f.stored()).toEqual([]);
    expect(await f.remembered()).toBeUndefined();
  });

  it("writes nothing for a chat or a turn deleted meanwhile", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) => ctx.db.delete("chats", f.chatId));
    expect(await f.run([candidate()])).toBe(0);
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.turnId));
    const other = await f.chat();
    expect(await f.run([candidate()], { chatId: other })).toBe(0);
    expect(await f.stored()).toEqual([]);
  });

  it("writes nothing for no candidates", async () => {
    const f = await fixture();
    expect(await f.run([])).toBe(0);
    expect(await f.stored()).toEqual([]);
    expect(await f.remembered()).toBeUndefined();
  });
});
