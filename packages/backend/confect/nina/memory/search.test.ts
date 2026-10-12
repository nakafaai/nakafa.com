import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  candidate,
  createCaptureTest,
  createMemoryTest,
} from "@repo/backend/test/nina/memory";
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

/** Seeds one memory for each confirmation time, in the order given, each reading `<word> <time>`. */
async function seedConfirmed(
  f: Awaited<ReturnType<typeof createMemoryTest>>,
  word: string,
  confirmations: readonly number[]
) {
  for (const confirmedAt of confirmations) {
    await f.seed({ confirmedAt, text: `${word} ${confirmedAt}` });
  }
}

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

  it("finds a memory by a word of any length, common or not, because no list and no minimum length decides what a word is", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Kelas yang sulit di 5" });
    for (const query of ["yang", "the yang", "di", "5", "yang di 5"]) {
      expect(await f.find({ limit: 5, text: query })).toEqual([
        "Kelas yang sulit di 5",
      ]);
    }
  });

  it("finds a memory in a script that puts no space between words, by the words of another sentence", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "高校三年生で、来年は東京大学を目指しています。" });
    await f.seed({ text: "確率が苦手です。" });
    expect(await f.find({ limit: 5, text: "東京大学に行きたい" })).toEqual([
      "高校三年生で、来年は東京大学を目指しています。",
    ]);
    expect(await f.find({ limit: 5, text: "確率" })).toEqual([
      "確率が苦手です。",
    ]);
  });

  it("ranks a memory with a rare word above memories with a word that many hold, though they are newer", async () => {
    const f = await createMemoryTest();
    await f.seed({ confirmedAt: 1, text: "Turunan fungsi" });
    // Ten newer memories hold "yang"; with one point for every word they would all outrank the older one.
    await seedConfirmed(
      f,
      "Kelas yang sulit",
      Arr.makeBy(10, (index) => 10 + index)
    );
    const found = await f.find({ limit: 3, text: "yang turunan" });
    expect(Arr.head(found)).toEqual(Option.some("Turunan fungsi"));
    expect(found).toHaveLength(3);
  });

  it("ranks a memory with a word that fewer memories hold above one with a word that more hold, whatever their confirmation", async () => {
    const f = await createMemoryTest();
    await f.seed({ confirmedAt: 50, text: "Limit sulit" });
    await f.seed({ confirmedAt: 40, text: "Limit mudah" });
    await f.seed({ confirmedAt: 30, text: "Limit dasar" });
    await f.seed({ confirmedAt: 20, text: "Integral sulit" });
    // "limit" is held by three memories and "integral" by one, so the older memory ranks first.
    expect(await f.find({ limit: 5, text: "limit integral" })).toEqual([
      "Integral sulit",
      "Limit sulit",
      "Limit mudah",
      "Limit dasar",
    ]);
  });

  it("looks up the longest words first when the text has more words than keys", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "trigonometri" });
    // Nineteen short words come first, and the one long word comes last: of sixteen keys, the long word still gets one.
    const shorts = Arr.makeBy(
      19,
      (index) => `x${String(index).padStart(2, "0")}`
    );
    expect(
      await f.find({
        limit: 5,
        text: Arr.join(Arr.append(shorts, "trigonometri"), " "),
      })
    ).toEqual(["trigonometri"]);
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

  it("leaves out a situation that ended before the caller's time, and without a time returns every stored memory", async () => {
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
    expect(await f.find({ limit: 5, now: NOW, text: "ulangan" })).toEqual([
      "Ulangan harian",
      "Ulangan baru",
    ]);
    // Without a time, nothing is left out for having ended.
    expect(await f.find({ limit: 5, text: "ulangan" })).toEqual([
      "Ulangan harian",
      "Ulangan baru",
      "Ulangan lama",
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

  it("never finds a memory that Delete all took, though a batch still holds it, and finds one confirmed after", async () => {
    const f = await createMemoryTest();
    await f.seed({ confirmedAt: 1, text: "Limit lama", topics: [PATH] });
    await f.seed({ confirmedAt: 5, text: "Limit tengah" });
    await f.markCleared(5);
    await f.seed({ confirmedAt: 6, text: "Limit baru" });
    expect(await f.find({ limit: 5, text: "limit", topics: [PATH] })).toEqual([
      "Limit baru",
    ]);
    // When the learner has nothing left, the search does not look for keys.
    await f.markCleared(6);
    expect(await f.find({ limit: 5, text: "limit", topics: [PATH] })).toEqual(
      []
    );
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
  it("reads the 24 memories most recently confirmed for a key, however many a learner keeps, and returns at most the limit", async () => {
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

  it("reads the memories most recently confirmed for a key, not the ones most recently written", async () => {
    const f = await createMemoryTest();
    // The newest confirmation is written first, so the order of writing is the
    // reverse of the order of confirming.
    await seedConfirmed(
      f,
      "memory",
      Arr.makeBy(30, (index) => 30 - index)
    );
    const found = await f.find({ limit: 50, text: "memory" });
    expect(found).toHaveLength(24);
    expect(Arr.head(found)).toEqual(Option.some("memory 30"));
    expect(Arr.last(found)).toEqual(Option.some("memory 7"));
  });

  it("gives the places to the newest confirmations among equal scores, though the memories were written first and the limit is small", async () => {
    const f = await createMemoryTest();
    await f.seed({ confirmedAt: 100, text: "limit lama" });
    await f.seed({ confirmedAt: 1, text: "limit satu" });
    await f.seed({ confirmedAt: 2, text: "limit dua" });
    await f.seed({ confirmedAt: 3, text: "limit tiga" });
    await f.seed({ confirmedAt: 4, text: "limit empat" });
    // A limit of 1 loads 3 memories: the 3 confirmed last, not the 3 written last.
    expect(await f.find({ limit: 1, text: "limit" })).toEqual(["limit lama"]);
    expect(await f.find({ limit: 2, text: "limit" })).toEqual([
      "limit lama",
      "limit empat",
    ]);
  });

  it("loads no more than 48 memories, however large the limit", async () => {
    const f = await createMemoryTest();
    // Three words, 24 memories each: 72 matches of one point.
    for (const word of ["alfa", "beta", "gamma"]) {
      await f.fill(24, { text: word });
    }
    expect(await f.find({ limit: 50, text: "alfa beta gamma" })).toHaveLength(
      48
    );
  });

  it("keeps the newest confirmations among equal scores whatever the order of the words", async () => {
    const f = await createMemoryTest();
    // Three words, six memories each, all of one point. A limit of 4 loads 12,
    // and the newest confirmations hold the word that is written last.
    await seedConfirmed(f, "alfa", [1, 2, 3, 4, 5, 6]);
    await seedConfirmed(f, "beta", [11, 12, 13, 14, 15, 16]);
    await seedConfirmed(f, "gamma", [101, 102, 103, 104, 105, 106]);
    for (const text of ["alfa beta gamma", "gamma beta alfa"]) {
      expect(await f.find({ limit: 4, text })).toEqual([
        "gamma 106",
        "gamma 105",
        "gamma 104",
        "gamma 103",
      ]);
    }
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

describe("memory search for the capture write", () => {
  it("finds the memory that says the same among 300, so the write confirms it and adds no copy", async () => {
    const f = await createCaptureTest();
    await f.fill(299, { author: "learner" });
    // The call read the first twelve memories, and not this one.
    const id = await f.seed({ kind: "level", text: "Kelas 12 IPA." });
    expect(await f.run([candidate()])).toBe(1);
    expect(await f.stored()).toHaveLength(300);
    expect(await f.stored()).toContainEqual(
      expect.objectContaining({ _id: id, confirmedAt: NOW })
    );
  });

  it("writes a new memory instead of confirming one that Delete all took, which a confirmation would bring back", async () => {
    const f = await createCaptureTest();
    await f.seed({ confirmedAt: 1, kind: "level", text: "Kelas 12 IPA." });
    await f.markCleared(NOW - 1);
    expect(await f.run([candidate()], { seen: [] })).toBe(1);
    const rows = await f.stored();
    expect(rows).toHaveLength(2);
    // The memory the learner deleted keeps its time, so the batches still reach it.
    expect(rows[0]).toMatchObject({ confirmedAt: 1 });
    expect(rows[1]).toMatchObject({ author: "nina", confirmedAt: NOW });
  });
});
