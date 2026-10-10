import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MEMORY_LIMIT,
  type NinaMemoryCandidate,
  type NinaMemorySeen,
} from "@repo/backend/confect/nina/memory.spec";
import { createMemoryTest } from "@repo/backend/test/nina/memory";

const capture = Ref.getFunctionReference(refs.internal.nina.memory.capture);
const clear = Ref.getFunctionReference(refs.public.nina.memory.clear);
const edit = Ref.getFunctionReference(refs.public.nina.memory.edit);
const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);
const remove = Ref.getFunctionReference(refs.public.nina.memory.remove);

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

/**
 * A learner with a chat and a turn, and a way to run one capture for them.
 * `seen` is what the capture call read before the model read the message.
 */
async function fixture() {
  const f = await createMemoryTest();
  const run = (
    candidates: (typeof NinaMemoryCandidate.Type)[],
    {
      lesson,
      seen = [],
    }: { lesson?: string; seen?: (typeof NinaMemorySeen.Type)[] } = {}
  ) =>
    f.t.mutation(capture, {
      candidates,
      ...(lesson === undefined ? {} : { lesson }),
      seen,
      turnId: f.turnId,
      userId: f.identity.userId,
    });
  const remembered = async () =>
    (await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId)))?.remembered;
  return { ...f, remembered, run };
}

describe("memory capture write", () => {
  it("writes a new memory as Nina's own, sealed, with the lesson", async () => {
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
      await f.run(
        [
          candidate({
            kind: "situation",
            known: id,
            text: "Ulangan kimia diundur",
            until: "2026-10-25",
          }),
        ],
        { seen: [{ confirmedAt: 1, id }] }
      )
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

  it("rewrites the known memory as Nina's words and kind, and keeps its lesson and its place", async () => {
    const f = await fixture();
    const id = await f.seed({
      author: "learner",
      confirmedAt: 1,
      lesson: "material:lesson:chemistry",
      text: "Kelas 11.",
    });
    expect(await f.run([candidate({ known: id })], { lesson: LESSON })).toBe(1);
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        _id: id,
        author: "nina",
        confirmedAt: NOW,
        kind: "level",
        lesson: "material:lesson:chemistry",
      }),
    ]);
    expect(await f.texts()).toEqual(["Kelas 12 IPA."]);
    expect(await f.remembered()).toBe(1);
  });

  it("confirms a memory without changing its words when they are the same, and the learner stays its author", async () => {
    const f = await fixture();
    const id = await f.seed({
      author: "learner",
      confirmedAt: 1,
      kind: "level",
      text: "Kelas 12 IPA",
    });
    const [before] = await f.stored();
    expect(await f.run([candidate({ known: id })])).toBe(1);
    const [after] = await f.stored();
    expect(after).toMatchObject({ author: "learner", confirmedAt: NOW });
    // `toEqual` takes any two sealed buffers for equal; `toStrictEqual` compares their bytes.
    expect(after?.text).toStrictEqual(before?.text);
    expect(await f.texts()).toEqual(["Kelas 12 IPA"]);
  });

  it("gives a memory the learner wrote the kind of the candidate that names it, or that says the same", async () => {
    const f = await fixture();
    const named = await f.seed({ author: "learner", text: "Kelas 11" });
    await f.seed({ author: "learner", text: "Mau ikut SNBT 2027" });
    expect(
      await f.run([
        candidate({ known: named }),
        candidate({
          kind: "goal",
          quote: "mau ikut snbt 2027",
          text: "mau ikut SNBT 2027!",
        }),
      ])
    ).toBe(2);
    // The words of the first are new, so Nina becomes their author; the second
    // says the same words, so the learner stays the author of them.
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        author: "nina",
        confirmedAt: NOW,
        kind: "level",
      }),
      expect.objectContaining({
        author: "learner",
        confirmedAt: NOW,
        kind: "goal",
      }),
    ]);
    expect(await f.texts()).toEqual(["Kelas 12 IPA.", "Mau ikut SNBT 2027"]);
  });

  it("dates a memory the learner wrote when a chat says it is a situation", async () => {
    const f = await fixture();
    const id = await f.seed({ author: "learner", text: "Ulangan kimia" });
    expect(
      await f.run([
        candidate({
          kind: "situation",
          known: id,
          text: "Ulangan kimia.",
          until: "2026-10-25",
        }),
      ])
    ).toBe(1);
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        author: "learner",
        kind: "situation",
        validUntil: Date.UTC(2026, 9, 25, 23, 59, 59, 999),
      }),
    ]);
  });

  it("writes a new memory when the memory it names or repeats is of another kind, or the known memory is another learner's", async () => {
    const f = await fixture();
    const other = await f.stranger();
    const goal = await f.seed({ kind: "goal", text: "Ikut SNBT" });
    const theirs = await f.seed({
      kind: "level",
      text: "Kelas 9",
      userId: other.userId,
    });
    expect(await f.run([candidate({ known: goal })])).toBe(1);
    expect(await f.run([candidate({ text: "Ikut SNBT" })])).toBe(1);
    expect(
      await f.run([candidate({ known: theirs, text: "Kelas 12 SMA." })])
    ).toBe(1);
    expect(await f.texts()).toEqual([
      "Ikut SNBT",
      "Kelas 12 IPA.",
      "Ikut SNBT",
      "Kelas 12 SMA.",
    ]);
    expect(await f.stored()).toContainEqual(
      expect.objectContaining({ _id: goal, confirmedAt: 1, kind: "goal" })
    );
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
});

describe("memory capture write after the learner changed their memory", () => {
  it("writes nothing when the learner removed a memory the call had read", async () => {
    const f = await fixture();
    const kept = await f.seed({ author: "learner", text: "Stays" });
    const gone = await f.seed({ text: "Mau ikut SNBT 2027" });
    const seen = [
      { confirmedAt: 1, id: kept },
      { confirmedAt: 1, id: gone },
    ];
    await f.owner.mutation(remove, { id: gone });
    expect(await f.run([candidate()], { seen })).toBe(0);
    expect(await f.texts()).toEqual(["Stays"]);
    expect(await f.remembered()).toBeUndefined();
  });

  it("writes nothing when the learner cleared their memory after the call read it", async () => {
    const f = await fixture();
    const id = await f.seed({ text: "Mau ikut SNBT 2027" });
    await f.owner.mutation(clear, {});
    expect(await f.run([candidate()], { seen: [{ confirmedAt: 1, id }] })).toBe(
      0
    );
    expect(await f.stored()).toEqual([]);
  });

  it("writes when every memory the call had read is still there, and when it had read none", async () => {
    const f = await fixture();
    const id = await f.seed({ kind: "goal", text: "Mau ikut SNBT 2027" });
    expect(await f.run([candidate()], { seen: [{ confirmedAt: 1, id }] })).toBe(
      1
    );
    expect(
      await f.run([candidate({ kind: "style", text: "Contoh dulu" })])
    ).toBe(1);
    expect(await f.texts()).toEqual([
      "Mau ikut SNBT 2027",
      "Kelas 12 IPA.",
      "Contoh dulu",
    ]);
  });

  it("keeps the words the learner edited after the call read the memory, and gives it no kind", async () => {
    const f = await fixture();
    const id = await f.seed({
      author: "learner",
      confirmedAt: 1,
      text: "Kelas 11.",
    });
    const seen = [{ confirmedAt: 1, id }];
    vi.setSystemTime(NOW + 1000);
    await f.owner.mutation(edit, { id, text: "Kelas 12 SMA" });
    vi.setSystemTime(NOW + 2000);
    expect(await f.run([candidate({ known: id })], { seen })).toBe(1);
    expect(await f.texts()).toEqual(["Kelas 12 SMA"]);
    const [row] = await f.stored();
    expect(row).toMatchObject({ author: "learner", confirmedAt: NOW + 2000 });
    // A memory that changed since the call read it is not given the kind either.
    expect(row).not.toHaveProperty("kind");
  });

  it("keeps the words, the kind and the end of a situation that the learner edited after the call read it", async () => {
    const f = await fixture();
    const validUntil = Date.UTC(2026, 9, 12, 23, 59, 59, 999);
    const id = await f.seed({
      confirmedAt: 1,
      kind: "situation",
      text: "Ulangan kimia",
      validUntil,
    });
    const seen = [{ confirmedAt: 1, id }];
    vi.setSystemTime(NOW + 1000);
    await f.owner.mutation(edit, { id, text: "Ulangan kimia hari Senin" });
    vi.setSystemTime(NOW + 2000);
    expect(
      await f.run(
        [
          candidate({
            kind: "situation",
            known: id,
            text: "Ulangan kimia diundur",
            until: "2026-10-25",
          }),
        ],
        { seen }
      )
    ).toBe(1);
    expect(await f.texts()).toEqual(["Ulangan kimia hari Senin"]);
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        author: "learner",
        confirmedAt: NOW + 2000,
        kind: "situation",
        validUntil,
      }),
    ]);
  });

  it("rewrites a memory that is still as the call read it, and gives it the kind", async () => {
    const f = await fixture();
    const id = await f.seed({
      author: "learner",
      confirmedAt: 1,
      text: "Kelas 11.",
    });
    expect(
      await f.run([candidate({ known: id })], {
        seen: [{ confirmedAt: 1, id }],
      })
    ).toBe(1);
    expect(await f.texts()).toEqual(["Kelas 12 IPA."]);
    expect(await f.stored()).toEqual([
      expect.objectContaining({ author: "nina", kind: "level" }),
    ]);
  });
});

describe("memory capture write at the limit", () => {
  it("drops the Nina-written memory confirmed longest ago", async () => {
    const f = await fixture();
    await f.seed({ confirmedAt: 0, text: "Oldest" });
    await f.fill(MEMORY_LIMIT - 1);
    expect(await f.run([candidate()])).toBe(1);
    const texts = await f.texts();
    expect(texts).toHaveLength(MEMORY_LIMIT);
    expect(texts).not.toContain("Oldest");
    expect(texts).toContain("Kelas 12 IPA.");
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

  it("writes nothing for a turn deleted meanwhile", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.turnId));
    expect(await f.run([candidate()])).toBe(0);
    expect(await f.stored()).toEqual([]);
  });

  it("writes whether or not the chat of the turn still exists, because it reads no chat", async () => {
    const f = await fixture();
    expect(await f.run([candidate()])).toBe(1);
    await f.t.mutation((ctx) => ctx.db.delete("chats", f.chatId));
    expect(
      await f.run([
        candidate({
          kind: "style",
          quote: "contoh soal",
          text: "Suka contoh soal.",
        }),
      ])
    ).toBe(1);
    expect(await f.texts()).toEqual(["Kelas 12 IPA.", "Suka contoh soal."]);
  });

  it("writes nothing for no candidates", async () => {
    const f = await fixture();
    expect(await f.run([])).toBe(0);
    expect(await f.stored()).toEqual([]);
    expect(await f.remembered()).toBeUndefined();
  });
});
