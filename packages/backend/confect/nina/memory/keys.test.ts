import { describe, expect, it } from "@effect/vitest";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  deleteKeys,
  readLinked,
  syncKeys,
} from "@repo/backend/confect/nina/memory/keys";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
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
    for (const word of ["sekola", "kelas", "12", "ipa"]) {
      expect(words).toContain(await f.wordKeyOf(word));
      expect(Arr.join(keys, ",")).not.toContain(word);
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

  it("writes nothing when the memory says what its keys already say", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({ text: "Kelas 12 IPA", topics: [PATH] });
    const before = await f.keys();
    await sync(f, id, { text: "Kelas 12 IPA", topics: [PATH] });
    expect(await f.keys()).toStrictEqual(before);
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

  it("reads the memories linked to a key, the most recently linked first, at most the limit", async () => {
    const f = await createMemoryTest();
    const first = await f.seed({ text: "Limit fungsi" });
    const second = await f.seed({ text: "Limit trigonometri" });
    const third = await f.seed({ text: "Limit barisan" });
    await f.seed({ text: "Turunan" });
    const key = await f.wordKeyOf("limit");
    const linked = (limit: number) =>
      f.execute(readLinked(f.identity.userId, key, limit));
    expect(await linked(10)).toEqual([third, second, first]);
    expect(await linked(2)).toEqual([third, second]);
  });
});
