import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MEMORY_LIMIT,
  MEMORY_PROMPT_LIMIT,
  type NinaLearner,
  type NinaMemoryList,
  type NinaMemoryView,
} from "@repo/backend/confect/nina/memory.spec";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { Array as Arr } from "effect";

const memory = refs.public.nina.memory;
const list = Ref.getFunctionReference(memory.list);
const add = Ref.getFunctionReference(memory.add);
const edit = Ref.getFunctionReference(memory.edit);
const remove = Ref.getFunctionReference(memory.remove);
const read = Ref.getFunctionReference(refs.internal.nina.memory.read);

const NOW = Date.UTC(2026, 9, 10, 12);
const LESSON = "material:lesson:mathematics:material-section:limits";
const rejected = (reason: "empty" | "limit" | "missing") => ({
  data: { _tag: "NinaMemoryRejected", reason },
});
/** The arguments refuse the title before the function runs, which is no `NinaMemoryRejected`. */
const refusedTitle = {
  _tag: "SchemaError",
  message: expect.stringContaining('["title"]'),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/** The Memory page as a learner's browser decodes it. */
async function pageOf(
  learner: Awaited<ReturnType<typeof createMemoryTest>>["owner"]
) {
  return Ref.decodeReturnsSync(memory.list, await learner.query(list, {}));
}

/** The words of each memory on the Memory page, in the order it lists them. */
function words(page: typeof NinaMemoryList.Type | null) {
  return Arr.map(page?.memories ?? [], (item) => item.text);
}

/** One memory on the Memory page, as its words and whether Nina reads it. */
function shown({ inUse, text }: typeof NinaMemoryView.Type) {
  return [text, inUse];
}

/** The words of each memory Nina reads, in the order she reads them. */
function prompted(learner: Pick<typeof NinaLearner.Type, "prompt">) {
  return Arr.map(learner.prompt, (item) => item.text);
}

/** The words and the title of each memory that a turn tells about. */
function titled(notes: (typeof NinaLearner.Type)["known"]) {
  return Arr.map(notes, ({ text, title }) => [text, title]);
}

describe("Nina memory page", () => {
  it("shows nothing to a visitor and an empty memory to a learner who has none", async () => {
    const f = await createMemoryTest();
    expect(await f.t.query(list, {})).toBeNull();
    expect(await f.owner.query(list, {})).toEqual({
      memories: [],
      paused: false,
    });
  });

  it("adds memories as the learner's pure text, sealed at rest, and lists them opened, the newest first", async () => {
    const f = await createMemoryTest();
    vi.setSystemTime(1000);
    const level = await f.owner.mutation(add, { text: "Kelas 12 IPA" });
    vi.setSystemTime(2000);
    await f.owner.mutation(add, { text: "Ikut SNBT 2027" });
    const view = await f.owner.query(list, {});
    expect(view).toEqual({
      memories: [
        {
          author: "learner",
          confirmedAt: 2000,
          createdAt: expect.any(Number),
          id: expect.any(String),
          inUse: true,
          text: "Ikut SNBT 2027",
        },
        {
          author: "learner",
          confirmedAt: 1000,
          createdAt: expect.any(Number),
          id: level,
          inUse: true,
          text: "Kelas 12 IPA",
        },
      ],
      paused: false,
    });
    expect(await f.stored()).toHaveLength(2);
    for (const row of await f.stored()) {
      const bytes = new TextDecoder("latin1").decode(row.text);
      expect(bytes).not.toContain("Kelas 12");
      expect(bytes).not.toContain("SNBT");
      // The learner writes pure text: the memory is theirs, with no kind, and
      // words alone give it no title.
      expect(row).toMatchObject({ author: "learner" });
      expect(row).not.toHaveProperty("kind");
      expect(row).not.toHaveProperty("title");
    }
    expect(view?.memories[0]).not.toHaveProperty("title");
    expect(
      await f.t.query((ctx) => ctx.db.query("vaultKeys").collect())
    ).toHaveLength(1);
  });

  it("adds a memory with a title and words, seals both at rest, and lists both opened", async () => {
    const f = await createMemoryTest();
    const id = await f.owner.mutation(add, {
      text: "Kelas 12 IPA",
      title: "Sekolah",
    });
    expect(await pageOf(f.owner)).toMatchObject({
      memories: [
        { author: "learner", id, text: "Kelas 12 IPA", title: "Sekolah" },
      ],
    });
    const [row] = await f.stored();
    expect(row?.title).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder("latin1").decode(row?.text)).not.toContain("Kelas");
    expect(new TextDecoder("latin1").decode(row?.title)).not.toContain(
      "Sekolah"
    );
    expect(await f.titles()).toEqual(["Sekolah"]);
  });

  it("adds a memory that is only a title, and lists it with no words", async () => {
    const f = await createMemoryTest();
    vi.setSystemTime(1000);
    await f.owner.mutation(add, { text: "", title: "Ujian akhir" });
    vi.setSystemTime(2000);
    await f.owner.mutation(add, { text: "Ikut SNBT 2027" });
    const view = await pageOf(f.owner);
    expect(
      Arr.map(view?.memories ?? [], (item) => [item.text, item.title])
    ).toEqual([
      ["Ikut SNBT 2027", undefined],
      ["", "Ujian akhir"],
    ]);
    expect(view?.memories[0]).not.toHaveProperty("title");
    expect(await f.texts()).toEqual(["", "Ikut SNBT 2027"]);
    expect(await f.titles()).toEqual(["Ujian akhir", null]);
  });

  it("shows a memory Nina wrote as its words alone, without its kind", async () => {
    const f = await createMemoryTest();
    await f.seed({
      kind: "situation",
      text: "Ulangan kimia",
      validUntil: NOW + 1,
    });
    expect(await f.owner.query(list, {})).toEqual({
      memories: [
        {
          author: "nina",
          confirmedAt: 1,
          createdAt: expect.any(Number),
          id: expect.any(String),
          inUse: true,
          text: "Ulangan kimia",
          validUntil: NOW + 1,
        },
      ],
      paused: false,
    });
  });

  it("keeps each learner's memories apart", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    const theirs = await other.owner.mutation(add, { text: "Rahasia mereka" });
    await f.owner.mutation(add, { text: "Punyaku" });
    expect(words(await pageOf(f.owner))).toEqual(["Punyaku"]);
    expect(words(await pageOf(other.owner))).toEqual(["Rahasia mereka"]);
    await expect(
      f.owner.mutation(edit, { id: theirs, text: "Diubah" })
    ).rejects.toMatchObject(rejected("missing"));
    expect(await f.owner.mutation(remove, { id: theirs })).toBeNull();
    expect(await f.texts(other.userId)).toEqual(["Rahasia mereka"]);
  });

  it("marks the memories Nina reads, and never a situation that ended", async () => {
    const f = await createMemoryTest();
    await f.fill(MEMORY_PROMPT_LIMIT + 2);
    await f.seed({ confirmedAt: MEMORY_PROMPT_LIMIT + 3, text: "Newest" });
    await f.seed({
      confirmedAt: MEMORY_PROMPT_LIMIT + 4,
      kind: "situation",
      text: "Ended",
      validUntil: NOW - 1,
    });
    const view = await pageOf(f.owner);
    expect(view?.memories).toHaveLength(MEMORY_PROMPT_LIMIT + 4);
    expect(Arr.take(words(view), 3)).toEqual(["Ended", "Newest", "Memory 21"]);
    // Nina reads the newest twenty of the rest, and never a situation that ended.
    expect(Arr.map(view?.memories ?? [], shown)).toEqual(
      expect.arrayContaining([
        ["Newest", true],
        ["Ended", false],
        ["Memory 21", true],
        ["Memory 3", true],
        ["Memory 2", false],
        ["Memory 0", false],
      ])
    );
    expect(Arr.filter(view?.memories ?? [], (item) => item.inUse)).toHaveLength(
      MEMORY_PROMPT_LIMIT
    );
  });
});

describe("Nina memory writes", () => {
  it("accepts words of 2000 characters and refuses 2001, when added and when edited", async () => {
    const f = await createMemoryTest();
    // The test names the numbers, not the constant, so a change of the limit fails it.
    const id = await f.owner.mutation(add, { text: "x".repeat(2000) });
    const text = "x".repeat(2001);
    await expect(f.owner.mutation(add, { text })).rejects.toThrow();
    await expect(f.owner.mutation(edit, { id, text })).rejects.toThrow();
    expect(
      await f.owner.mutation(edit, { id, text: "y".repeat(2000) })
    ).toBeNull();
    expect(await f.texts()).toEqual(["y".repeat(2000)]);
  });

  it("accepts a title of 80 characters and refuses 81, or one of only spaces, when added and when edited", async () => {
    const f = await createMemoryTest();
    // The test names the numbers, not the constant, so a change of the limit fails it.
    const id = await f.owner.mutation(add, {
      text: "Words",
      title: "t".repeat(80),
    });
    for (const title of ["t".repeat(81), "   ", ""]) {
      await expect(
        f.owner.mutation(add, { text: "Words", title })
      ).rejects.toMatchObject(refusedTitle);
      await expect(
        f.owner.mutation(edit, { id, text: "Words", title })
      ).rejects.toMatchObject(refusedTitle);
    }
    // The title is trimmed before it is measured.
    await f.owner.mutation(add, { text: "Words", title: `${"u".repeat(80)} ` });
    expect(await f.titles()).toEqual(["t".repeat(80), "u".repeat(80)]);
  });

  it("refuses a write with neither a title nor words, before it looks at the limit or at the memory, and changes nothing", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({
      author: "learner",
      text: "Kelas 11",
      title: "Sekolah",
    });
    const gone = await f.seed();
    await f.owner.mutation(remove, { id: gone });
    await f.fill(MEMORY_LIMIT - 1);
    const before = await f.stored();
    vi.setSystemTime(NOW + 1000);
    // The learner is at the limit, and one memory is gone: `empty` comes first.
    for (const text of ["", "   ", "\n\t"]) {
      for (const call of [
        () => f.owner.mutation(add, { text }),
        () => f.owner.mutation(edit, { id, text }),
        () => f.owner.mutation(edit, { id: gone, text }),
      ]) {
        await expect(call()).rejects.toMatchObject(rejected("empty"));
      }
    }
    await expect(
      f.owner.mutation(add, { text: "One too many" })
    ).rejects.toMatchObject(rejected("limit"));
    // `toStrictEqual` compares the sealed bytes; `toEqual` takes any two buffers for equal.
    expect(await f.stored()).toStrictEqual(before);
  });

  it("keeps the Markdown of a memory as the learner wrote it, when added, edited and listed", async () => {
    const f = await createMemoryTest();
    const text = "## Tujuan\n\n- **SNBT** 2027\n- [ ] Latihan `peluang`";
    const id = await f.owner.mutation(add, { text });
    expect(await f.texts()).toEqual([text]);
    expect(words(await pageOf(f.owner))).toEqual([text]);
    const edited = `${text}\n\n> Catatan`;
    await f.owner.mutation(edit, { id, text: edited });
    expect(words(await pageOf(f.owner))).toEqual([edited]);
  });

  it("refuses a memory beyond the limit and accepts the last one that fits", async () => {
    const f = await createMemoryTest();
    await f.fill(MEMORY_LIMIT - 1);
    await f.owner.mutation(add, { text: "The last one" });
    await expect(
      f.owner.mutation(add, { text: "One too many" })
    ).rejects.toMatchObject(rejected("limit"));
    expect(await f.stored()).toHaveLength(MEMORY_LIMIT);
  });

  it("writes nothing when the vault cannot seal", async () => {
    const f = await createMemoryTest();
    vi.stubEnv("VAULT_ROOT_KEYS", "");
    await expect(
      f.owner.mutation(add, { text: "Never stored" })
    ).rejects.toThrow();
    expect(await f.stored()).toEqual([]);
  });

  it("edits the words as the learner, keeping the kind, the lesson and a situation's end", async () => {
    const f = await createMemoryTest();
    const validUntil = Date.UTC(2026, 9, 20, 23, 59, 59, 999);
    const id = await f.seed({
      kind: "situation",
      lesson: LESSON,
      text: "Ulangan kimia",
      validUntil,
    });
    vi.setSystemTime(5000);
    expect(
      await f.owner.mutation(edit, { id, text: "Ulangan kimia 20 Oktober" })
    ).toBeNull();
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        author: "learner",
        confirmedAt: 5000,
        kind: "situation",
        lesson: LESSON,
        validUntil,
      }),
    ]);
    expect(await f.texts()).toEqual(["Ulangan kimia 20 Oktober"]);
  });

  it("gives a memory the learner wrote no kind when the learner edits it", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({ author: "learner", text: "Kelas 11" });
    await f.owner.mutation(edit, { id, text: "Kelas 12" });
    const [row] = await f.stored();
    expect(row).toMatchObject({ author: "learner" });
    expect(row).not.toHaveProperty("kind");
    expect(await f.texts()).toEqual(["Kelas 12"]);
  });

  it("gives a memory a title, replaces it, turns the memory into a title alone, and takes the title off when the write has none", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({ kind: "goal", text: "Kelas 11" });
    const edited = async (fields: { text: string; title?: string }) => {
      await f.owner.mutation(edit, { id, ...fields });
      return [await f.titles(), await f.texts()];
    };
    vi.setSystemTime(5000);
    expect(await edited({ text: "Kelas 12", title: "Sekolah lama" })).toEqual([
      ["Sekolah lama"],
      ["Kelas 12"],
    ]);
    expect(await edited({ text: "", title: "Sekolah baru" })).toEqual([
      ["Sekolah baru"],
      [""],
    ]);
    const [renamed] = await f.stored();
    expect(new TextDecoder("latin1").decode(renamed?.title)).not.toContain(
      "Sekolah"
    );
    expect(await pageOf(f.owner)).toMatchObject({
      memories: [{ text: "", title: "Sekolah baru" }],
    });
    expect(await edited({ text: "Kelas 12 IPA" })).toEqual([
      [null],
      ["Kelas 12 IPA"],
    ]);
    const [bare] = await f.stored();
    expect(bare).toMatchObject({
      author: "learner",
      confirmedAt: 5000,
      kind: "goal",
    });
    expect(bare).not.toHaveProperty("title");
    expect((await pageOf(f.owner))?.memories[0]).not.toHaveProperty("title");
  });

  it("refuses to edit a memory that is gone", async () => {
    const f = await createMemoryTest();
    const id = await f.seed();
    await f.owner.mutation(remove, { id });
    await expect(
      f.owner.mutation(edit, { id, text: "Too late" })
    ).rejects.toMatchObject(rejected("missing"));
  });
});

describe("Nina memory for a turn", () => {
  it("chooses what Nina reads for the open lesson and tells the capture call about every memory", async () => {
    const f = await createMemoryTest();
    const userId = f.identity.userId;
    await f.fill(MEMORY_PROMPT_LIMIT);
    await f.seed({ confirmedAt: 0, lesson: LESSON, text: "About the lesson" });
    await f.seed({ author: "learner", confirmedAt: 0, text: "Mine" });
    await f.seed({ kind: "situation", text: "Ended", validUntil: NOW - 1 });
    const newest = (count: number) =>
      Arr.makeBy(count, (index) => `Memory ${MEMORY_PROMPT_LIMIT - 1 - index}`);
    const open = await f.t.query(read, { lesson: LESSON, userId });
    expect(open.paused).toBe(false);
    expect(prompted(open)).toEqual([
      "Mine",
      "About the lesson",
      ...newest(MEMORY_PROMPT_LIMIT - 2),
    ]);
    expect(open.known).toHaveLength(MEMORY_PROMPT_LIMIT + 3);
    expect(open.known).toContainEqual({
      confirmedAt: 1,
      id: expect.any(String),
      kind: "situation",
      text: "Ended",
    });
    // A memory the learner wrote has no kind to tell.
    expect(open.known).toContainEqual({
      confirmedAt: 0,
      id: expect.any(String),
      text: "Mine",
    });
    expect(open.prompt).toContainEqual({
      confirmedAt: 0,
      id: expect.any(String),
      text: "Mine",
    });
    expect(prompted(await f.t.query(read, { userId }))).toEqual([
      "Mine",
      ...newest(MEMORY_PROMPT_LIMIT - 1),
    ]);
  });

  it("tells Nina and the capture call the title of a memory that has one, and of no other", async () => {
    const f = await createMemoryTest();
    await f.seed({
      author: "learner",
      confirmedAt: 3,
      text: "Kelas 12 IPA",
      title: "Sekolah",
    });
    await f.seed({
      author: "learner",
      confirmedAt: 2,
      text: "",
      title: "Ujian akhir",
    });
    await f.seed({ confirmedAt: 1, text: "Ikut SNBT 2027" });
    const learner = await f.t.query(read, { userId: f.identity.userId });
    for (const side of [learner.known, learner.prompt]) {
      expect(titled(side)).toEqual([
        ["Kelas 12 IPA", "Sekolah"],
        ["", "Ujian akhir"],
        ["Ikut SNBT 2027", undefined],
      ]);
      expect(side[2]).not.toHaveProperty("title");
    }
  });
});
