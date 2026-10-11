import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { Array as Arr, Option } from "effect";

const edit = Ref.getFunctionReference(refs.public.nina.memory.edit);
const remove = Ref.getFunctionReference(refs.public.nina.memory.remove);

const NOW = Date.UTC(2026, 9, 10, 12);
const LESSON = "lesson:material:lesson:mathematics:material-section:limits";
const PATH = "path:materials/mathematics";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("memory search", () => {
  it("finds a memory by a word of its title and by a word of its text", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Kelas 12 IPA", title: "Sekolah" });
    await f.seed({ text: "Mau ikut SNBT 2027" });
    expect(await f.find({ limit: 5, text: "sekolah" })).toEqual([
      "Kelas 12 IPA",
    ]);
    expect(await f.find({ limit: 5, text: "Bagaimana SNBT?" })).toEqual([
      "Mau ikut SNBT 2027",
    ]);
  });

  it("finds a memory across languages, because a word is cut to its first six letters", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Aku belajar trigonometri" });
    for (const query of ["trigonometry", "Trigonometrie", "trigonometri"]) {
      expect(await f.find({ limit: 5, text: query })).toEqual([
        "Aku belajar trigonometri",
      ]);
    }
  });

  it("finds nothing by a stop word, a word of two letters or a single digit, though the memory holds them", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Kelas yang sulit di 5" });
    for (const query of ["yang", "the dan und", "di", "5", "yang di 5"]) {
      expect(await f.find({ limit: 5, text: query })).toEqual([]);
    }
  });

  it("finds nothing without a word or a topic", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Kelas 12 IPA", topics: [PATH] });
    expect(await f.find({ limit: 5 })).toEqual([]);
    expect(await f.find({ limit: 5, text: " ... ?! " })).toEqual([]);
    expect(await f.find({ limit: 5, text: "zzzzz", topics: [] })).toEqual([]);
  });

  it("finds nothing for a learner who has no memory and no key", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.seed({ text: "Limit fungsi", topics: [LESSON] });
    expect(
      await f.find({
        limit: 5,
        text: "limit",
        topics: [LESSON],
        userId: other.userId,
      })
    ).toEqual([]);
  });

  it("ranks the open lesson above a path above it, and a path above a word, though the word is newer", async () => {
    const f = await createMemoryTest();
    await f.seed({ confirmedAt: 1, text: "Bingung soal", topics: [LESSON] });
    await f.seed({ confirmedAt: 2, text: "Suka contoh", topics: [PATH] });
    await f.seed({ confirmedAt: 3, text: "Limit fungsi sulit" });
    expect(
      await f.find({
        limit: 5,
        text: "limit",
        topics: [LESSON, PATH],
      })
    ).toEqual(["Bingung soal", "Suka contoh", "Limit fungsi sulit"]);
  });

  it("ranks a memory with more matched keys above one with fewer, though the one with fewer is newer", async () => {
    const f = await createMemoryTest();
    await f.seed({ confirmedAt: 1, text: "Limit dan turunan" });
    await f.seed({ confirmedAt: 2, text: "Limit saja" });
    expect(await f.find({ limit: 5, text: "limit turunan" })).toEqual([
      "Limit dan turunan",
      "Limit saja",
    ]);
  });

  it("gives the memory confirmed last the first place among equal scores, though it was written first", async () => {
    const f = await createMemoryTest();
    await f.seed({ confirmedAt: 5, text: "Limit lama" });
    await f.seed({ confirmedAt: 3, text: "Limit baru" });
    expect(await f.find({ limit: 5, text: "limit" })).toEqual([
      "Limit lama",
      "Limit baru",
    ]);
  });

  it("never returns a situation that has ended, and returns one that still goes on", async () => {
    const f = await createMemoryTest();
    await f.seed({
      kind: "situation",
      text: "Ulangan lama",
      validUntil: NOW - 1,
    });
    await f.seed({
      kind: "situation",
      text: "Ulangan baru",
      validUntil: NOW + 1,
    });
    await f.seed({ author: "learner", text: "Ulangan harian" });
    expect(await f.find({ limit: 5, text: "ulangan" })).toEqual([
      "Ulangan harian",
      "Ulangan baru",
    ]);
  });

  it("never finds the memory of another learner, though both wrote the same word, and the two learners' keys for it differ", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.seed({ text: "Rahasia limit" });
    await f.seed({ text: "Rahasia limit mereka", userId: other.userId });
    expect(await f.find({ limit: 5, text: "limit" })).toEqual([
      "Rahasia limit",
    ]);
    expect(
      await f.find({ limit: 5, text: "limit", userId: other.userId })
    ).toEqual(["Rahasia limit mereka"]);
    // At the table: the same word is a different key for each learner, so the
    // database cannot tell that two learners wrote it.
    const ours = await f.wordKeyOf("limit");
    const theirs = await f.wordKeyOf("limit", other.userId);
    expect(ours).not.toBe(theirs);
    const rows = await f.keys();
    const owners = (key: string) =>
      Arr.map(
        Arr.filter(rows, (row) => row.key === key),
        (row) => row.userId
      );
    expect(owners(ours)).toEqual([f.identity.userId]);
    expect(owners(theirs)).toEqual([other.userId]);
  });

  it("stops finding a memory that was deleted, and leaves no key behind", async () => {
    const f = await createMemoryTest();
    const gone = await f.seed({ text: "Limit lama", topics: [PATH] });
    await f.seed({ text: "Limit baru" });
    await f.owner.mutation(remove, { id: gone });
    expect(await f.find({ limit: 5, text: "limit", topics: [PATH] })).toEqual([
      "Limit baru",
    ]);
    const rows = await f.keys();
    expect(Arr.map(rows, (row) => row.memoryId)).not.toContain(gone);
    expect(rows).toHaveLength(2);
  });

  it("follows an edit: a word that went finds nothing, and a word that came is found", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({ author: "learner", text: "Limit dan turunan" });
    expect(await f.find({ limit: 5, text: "turunan" })).toEqual([
      "Limit dan turunan",
    ]);
    await f.owner.mutation(edit, { id, text: "Limit dan integral" });
    expect(await f.find({ limit: 5, text: "turunan" })).toEqual([]);
    expect(await f.find({ limit: 5, text: "integral" })).toEqual([
      "Limit dan integral",
    ]);
    expect(await f.find({ limit: 5, text: "limit" })).toEqual([
      "Limit dan integral",
    ]);
  });
});

describe("memory search bounds", () => {
  it("reads the 24 memories most recently linked to a key, however many a learner keeps, and returns at most the limit", async () => {
    const f = await createMemoryTest();
    await f.fill(60);
    const found = await f.find({ limit: 50, text: "memory" });
    // The 24 newest of the 60 hold the word; the newest confirmation leads.
    expect(found).toHaveLength(24);
    expect(Arr.head(found)).toEqual(Option.some("Memory 59"));
    expect(Arr.last(found)).toEqual(Option.some("Memory 36"));
    expect(await f.find({ limit: 3, text: "memory" })).toEqual([
      "Memory 59",
      "Memory 58",
      "Memory 57",
    ]);
  });

  it("loads three times the limit of the best memories, so an older memory with the newest confirmation comes only with a larger limit", async () => {
    const f = await createMemoryTest();
    await f.seed({ confirmedAt: 100, text: "limit lama" });
    await f.seed({ confirmedAt: 1, text: "limit satu" });
    await f.seed({ confirmedAt: 2, text: "limit dua" });
    await f.seed({ confirmedAt: 3, text: "limit tiga" });
    await f.seed({ confirmedAt: 4, text: "limit empat" });
    // A limit of 1 loads the 3 memories linked last, which leave out the first.
    expect(await f.find({ limit: 1, text: "limit" })).toEqual(["limit empat"]);
    // A limit of 2 loads 6, which is every memory.
    expect(await f.find({ limit: 2, text: "limit" })).toEqual([
      "limit lama",
      "limit empat",
    ]);
  });

  it("loads no more than 48 memories, so a memory ranked after them is never returned", async () => {
    const f = await createMemoryTest();
    // Three words, 24 memories each. The last memory of the third word is the
    // newest confirmation of all, but 48 others of equal score rank before it.
    for (const word of ["alfa", "beta", "gamma"]) {
      await f.fill(24, { text: word });
    }
    await f.seed({ confirmedAt: 1000, text: "gamma" });
    const found = await f.find({ limit: 30, text: "alfa beta gamma" });
    expect(found).toHaveLength(30);
    expect(Arr.contains(found, "gamma")).toBe(false);
  });

  it("looks up at most sixteen keys, the topics before the words", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "alfa" });
    const topics = (count: number) =>
      Arr.makeBy(count, (index) => `path:materials/subject${index}`);
    expect(
      await f.find({ limit: 5, text: "alfa", topics: topics(15) })
    ).toEqual(["alfa"]);
    expect(
      await f.find({ limit: 5, text: "alfa", topics: topics(16) })
    ).toEqual([]);
  });
});
