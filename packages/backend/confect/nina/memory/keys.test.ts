import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  deleteKeys,
  readLinked,
  syncKeys,
} from "@repo/backend/confect/nina/memory/keys";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import { blindText } from "@repo/backend/confect/vault/text";
import {
  candidate,
  createCaptureTest,
  createMemoryTest,
} from "@repo/backend/test/nina/memory";
import { Array as Arr, Effect, String as Str } from "effect";

const LESSON = "lesson:material:lesson:mathematics:material-section:limits";
const PATH = "path:materials/mathematics";
const BLINDED = /^w:[\w-]{22}$/u;

/** Distinct words of five characters: `w0000`, `w0001`, and so on, from a prefix. */
const wordsFor = (prefix: string, count: number) =>
  Arr.makeBy(count, (index) => `${prefix}${String(index).padStart(4, "0")}`);

/** The keys of the rows, in storage order. */
const keysOf = (rows: readonly Docs["ninaMemoryKeys"][]) =>
  Arr.map(rows, ({ key }) => key);

/** Syncs a memory's keys to this content, as a writer of the memory does. */
const sync = (
  f: Awaited<ReturnType<typeof createMemoryTest>>,
  id: Docs["ninaMemories"]["_id"],
  content: Parameters<typeof syncKeys>[2]
) =>
  f.execute(
    Effect.flatMap(readLearnerKeys(f.identity.userId), (learner) =>
      syncKeys(learner, id, content)
    )
  );

describe("memory keys", () => {
  it("links a memory to a key for each of its topics and each of its words, none of them in the clear", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({
      text: "Kelas 12 IPA",
      title: "Sekolah",
      topics: [LESSON, PATH],
    });
    const rows = await f.keys();
    const keys = keysOf(rows);
    expect(keys).toHaveLength(6);
    for (const row of rows) {
      expect(row).toMatchObject({ memoryId: id, userId: f.identity.userId });
    }
    expect(keys).toContain(`t:${LESSON}`);
    expect(keys).toContain(`t:${PATH}`);
    const words = Arr.filter(keys, Str.startsWith("w:"));
    expect(words).toHaveLength(4);
    for (const word of words) {
      expect(word).toMatch(BLINDED);
    }
    // The hash is random for each learner, so the test names the shape and the
    // keys of the words, not text that the hash might hold by chance.
    for (const word of ["sekola", "kelas", "12", "ipa"]) {
      expect(words).toContain(await f.wordKeyOf(word));
      expect(keys).not.toContain(`w:${word}`);
    }
  });

  it("indexes the words of the title ahead of the words of the text, 96 in all, and 8 topics: 104 keys", async () => {
    const f = await createMemoryTest();
    await f.seed({
      text: Arr.join(wordsFor("t", 100), " "),
      title: Arr.join(wordsFor("w", 50), " "),
      topics: Arr.makeBy(8, (index) => `path:materials/subject${index}`),
    });
    const keys = keysOf(await f.keys());
    expect(keys).toHaveLength(104);
    // All 50 words of the title and the first 46 of the text fit.
    expect(keys).toContain(await f.wordKeyOf("w0049"));
    expect(keys).toContain(await f.wordKeyOf("t0045"));
    expect(keys).not.toContain(await f.wordKeyOf("t0046"));
  });

  it("indexes a word that the title and the text both hold once", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Kelas 12 IPA", title: "Kelas" });
    expect(await f.keys()).toHaveLength(3);
  });

  it("follows a change of words and topics: it deletes the keys that went, adds the new ones, and leaves the rest as they are", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({
      text: "Kelas dua belas",
      title: "Sekolah",
      topics: [PATH],
    });
    const before = await f.keys();
    await sync(f, id, {
      confirmedAt: 1,
      text: "Kelas dua puluh",
      title: "Sekolah",
      topics: [LESSON],
    });
    const after = await f.keys();
    const keys = keysOf(after);
    expect(keys).not.toContain(`t:${PATH}`);
    expect(keys).not.toContain(await f.wordKeyOf("belas"));
    expect(keys).toContain(`t:${LESSON}`);
    expect(keys).toContain(await f.wordKeyOf("puluh"));
    expect(after).toHaveLength(before.length);
    // The rows of the words that stayed are the same rows, not new ones.
    for (const word of ["kelas", "dua", "sekola"]) {
      const key = await f.wordKeyOf(word);
      expect(Arr.filter(after, (row) => row.key === key)).toStrictEqual(
        Arr.filter(before, (row) => row.key === key)
      );
    }
  });

  it("makes a word key under the version of the index, so that a key made under another version never equals it", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Kelas 12 IPA" });
    // Version 1 of the index blinded its words for the field `words`.
    const earlier = await f.execute(
      Effect.flatMap(readLearnerKeys(f.identity.userId), (learner) =>
        blindText(learner, { field: "words", table: "ninaMemories" }, "kelas")
      )
    );
    expect(`w:${earlier}`).not.toBe(await f.wordKeyOf("kelas"));
  });

  it("returns how many rows it wrote: none when nothing changed, two for a word that was replaced, and every row when the memory was confirmed later", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({
      confirmedAt: 1,
      text: "Kelas dua",
      topics: [PATH],
    });
    const content = { confirmedAt: 1, topics: [PATH] };
    expect(await sync(f, id, { ...content, text: "Kelas dua" })).toBe(0);
    // One key goes and one comes; the rows of the other keys stay.
    expect(await sync(f, id, { ...content, text: "Kelas tiga" })).toBe(2);
    // The topic and the two words each move to the new time.
    expect(
      await sync(f, id, { confirmedAt: 9, text: "Kelas tiga", topics: [PATH] })
    ).toBe(3);
  });

  it("writes nothing when the memory says what its keys already say, at the time they hold", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({ text: "Kelas 12 IPA", topics: [PATH] });
    const before = await f.keys();
    await sync(f, id, { confirmedAt: 1, text: "Kelas 12 IPA", topics: [PATH] });
    expect(await f.keys()).toStrictEqual(before);
  });

  it("moves every row of a memory to the time it was confirmed, adds none and deletes none, and moves no row of another memory", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({
      confirmedAt: 1,
      text: "Kelas 12 IPA",
      topics: [PATH],
    });
    const other = await f.seed({
      confirmedAt: 1,
      text: "Kelas 12 IPA",
      topics: [PATH],
    });
    const before = await f.keys();
    await sync(f, id, { confirmedAt: 7, text: "Kelas 12 IPA", topics: [PATH] });
    const after = await f.keys();
    expect(after).toHaveLength(before.length);
    for (const row of after) {
      // A moved row is the same row: only its time changed.
      expect(Arr.map(before, (old) => old._id)).toContain(row._id);
      expect(row.confirmedAt).toBe(row.memoryId === id ? 7 : 1);
    }
    expect(Arr.filter(after, (row) => row.memoryId === other)).toStrictEqual(
      Arr.filter(before, (row) => row.memoryId === other)
    );
  });

  it("gives the keys it adds, and the keys it moves, the time of the confirmation", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({
      confirmedAt: 3,
      text: "Kelas dua",
      topics: [PATH],
    });
    await sync(f, id, {
      confirmedAt: 9,
      text: "Kelas tiga",
      topics: [PATH, LESSON],
    });
    const rows = await f.keys();
    // Kelas, tiga, the path and the lesson: the word that went is gone.
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.confirmedAt).toBe(9);
    }
  });

  it("deletes the keys of one memory and leaves the keys of every other", async () => {
    const f = await createMemoryTest();
    const gone = await f.seed({ text: "Kelas 12 IPA", topics: [PATH] });
    const stays = await f.seed({ text: "Kelas 12 IPA", topics: [PATH] });
    await f.execute(deleteKeys(gone));
    const rows = await f.keys();
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.memoryId).toBe(stays);
    }
  });

  it("reads the memories linked to a key with their times, the most recently confirmed first, at most the limit", async () => {
    const f = await createMemoryTest();
    // Written in one order, confirmed in another.
    const first = await f.seed({ confirmedAt: 30, text: "Limit fungsi" });
    const second = await f.seed({ confirmedAt: 10, text: "Limit barisan" });
    const third = await f.seed({ confirmedAt: 20, text: "Limit deret" });
    await f.seed({ confirmedAt: 40, text: "Turunan" });
    const key = await f.wordKeyOf("limit");
    const linked = (limit: number, clearedAt?: number) =>
      f.execute(readLinked(f.identity.userId, key, limit, clearedAt));
    expect(await linked(10)).toEqual([
      { confirmedAt: 30, memoryId: first },
      { confirmedAt: 20, memoryId: third },
      { confirmedAt: 10, memoryId: second },
    ]);
    expect(await linked(2)).toEqual([
      { confirmedAt: 30, memoryId: first },
      { confirmedAt: 20, memoryId: third },
    ]);
    // The memories that "Delete all" took, confirmed at or before the moment
    // the learner asked, are the tail of the key and the range stops before them.
    expect(await linked(10, 20)).toEqual([
      { confirmedAt: 30, memoryId: first },
    ]);
    expect(await linked(10, 30)).toEqual([]);
  });
});

describe("memory keys over time", () => {
  const NOW = Date.UTC(2026, 9, 10, 12);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("keeps a memory among the first a key reads while the learner says it again and again, however many memories that share its words and page are written after it", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({
      confirmedAt: 1,
      kind: "level",
      text: "Saya belajar matematika",
      topics: [LESSON],
    });
    // The memory was stored first, so it is the first the capture call lists,
    // and the candidate that restates it names that place.
    const again = candidate({
      known: 1,
      quote: "saya belajar matematika",
      text: "Saya belajar matematika",
    });
    // Thirty memories share its words and its page, three between one saying
    // and the next. A key reads 24 memories, so the memory would fall out of
    // reach at the eighth saying if its keys kept the time it was written.
    for (const round of Arr.range(0, 9)) {
      const before = NOW + (round - 1) * 1000;
      for (const index of Arr.range(0, 2)) {
        await f.seed({
          confirmedAt: before + 1 + index,
          text: `Belajar matematika bab ${round}${index}`,
          topics: [LESSON],
        });
      }
      vi.setSystemTime(NOW + round * 1000);
      expect(await f.run([again], { topics: [LESSON] })).toBe(1);
    }
    expect(await f.stored()).toHaveLength(31);
    expect(await f.stored()).toContainEqual(
      expect.objectContaining({ _id: id, confirmedAt: NOW + 9000 })
    );
  });
});
