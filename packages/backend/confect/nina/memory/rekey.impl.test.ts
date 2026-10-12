import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import { blindText } from "@repo/backend/confect/vault/text";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { Array as Arr, Effect } from "effect";

const page = Ref.getFunctionReference(refs.internal.nina.memory.rekey.page);

const PATH = "path:materials/mathematics";

type Fixture = Awaited<ReturnType<typeof createMemoryTest>>;
type UserId = Fixture["identity"]["userId"];
type MemoryId = Awaited<ReturnType<Fixture["seed"]>>;

/**
 * Gives a memory the word keys that version 1 of the index made for these
 * words: blinded for the field `words`, as a memory written before version 2
 * holds them. The keys of its topics stay.
 */
async function makeOld(
  f: Fixture,
  id: MemoryId,
  words: readonly string[],
  userId: UserId = f.identity.userId
) {
  const earlier = await f.execute(
    Effect.flatMap(readLearnerKeys(userId), (learner) =>
      Effect.forEach(words, (word) =>
        blindText(learner, { field: "words", table: "ninaMemories" }, word)
      )
    )
  );
  await f.t.mutation(async (ctx) => {
    const rows = await ctx.db
      .query("ninaMemoryKeys")
      .withIndex("by_memoryId", (query) => query.eq("memoryId", id))
      .collect();
    for (const row of rows) {
      if (row.key.startsWith("w:")) {
        await ctx.db.delete(row._id);
      }
    }
    for (const word of earlier) {
      await ctx.db.insert("ninaMemoryKeys", {
        confirmedAt: 1,
        key: `w:${word}`,
        memoryId: id,
        userId,
      });
    }
  });
}

describe("memory re-keying", () => {
  it("finds an old memory again by its words once it is re-keyed, and a second pass changes nothing", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({ text: "Kelas 12 IPA", topics: [PATH] });
    await makeOld(f, id, ["kelas", "12", "ipa"]);
    // Its keys are of another version, so its words find nothing.
    expect(await f.find({ limit: 5, text: "kelas" })).toEqual([]);
    expect(await f.t.mutation(page, {})).toMatchObject({
      checked: 1,
      done: true,
      rekeyed: 1,
    });
    expect(await f.find({ limit: 5, text: "kelas" })).toEqual(["Kelas 12 IPA"]);
    // No old key is left: the topic and the three words of today.
    const after = await f.keys();
    expect(Arr.map(after, (row) => row.key)).toHaveLength(4);
    expect(Arr.map(after, (row) => row.key)).toEqual(
      expect.arrayContaining([
        `t:${PATH}`,
        await f.wordKeyOf("kelas"),
        await f.wordKeyOf("12"),
        await f.wordKeyOf("ipa"),
      ])
    );
    expect(await f.t.mutation(page, {})).toMatchObject({
      checked: 1,
      done: true,
      rekeyed: 0,
    });
    expect(await f.keys()).toStrictEqual(after);
  });

  it("re-keys the memories of every learner, each under the key of its own learner, with the words of the title", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    const mine = await f.seed({ text: "Limit fungsi", title: "Sekolah" });
    const theirs = await f.seed({
      text: "Limit barisan",
      userId: other.userId,
    });
    await makeOld(f, mine, ["sekola", "limit", "fungsi"]);
    await makeOld(f, theirs, ["limit", "barisa"], other.userId);
    expect(await f.t.mutation(page, {})).toMatchObject({
      checked: 2,
      done: true,
      rekeyed: 2,
    });
    expect(await f.find({ limit: 5, text: "sekolah" })).toEqual([
      "Limit fungsi",
    ]);
    expect(
      await f.find({ limit: 5, text: "barisan", userId: other.userId })
    ).toEqual(["Limit barisan"]);
    expect(await f.find({ limit: 5, text: "barisan" })).toEqual([]);
  });

  it("looks at 25 memories a page and hands over the cursor of the next page, which ends the walk", async () => {
    const f = await createMemoryTest();
    await f.fill(30);
    const first = await f.t.mutation(page, {});
    expect(first).toMatchObject({ checked: 25, done: false, rekeyed: 0 });
    expect(await f.t.mutation(page, { cursor: first.cursor })).toMatchObject({
      checked: 5,
      done: true,
      rekeyed: 0,
    });
  });

  it("looks at nothing when no memory exists", async () => {
    const f = await createMemoryTest();
    expect(await f.t.mutation(page, {})).toMatchObject({
      checked: 0,
      done: true,
      rekeyed: 0,
    });
  });
});
