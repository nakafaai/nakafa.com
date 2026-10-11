import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import type { NinaMemoryDraft } from "@repo/backend/confect/nina/memory.spec";
import {
  createMemoryTest,
  sessionRequired,
} from "@repo/backend/test/nina/memory";
import { Array as Arr } from "effect";

const memory = refs.public.nina.memory;
const add = Ref.getFunctionReference(memory.add);
const edit = Ref.getFunctionReference(memory.edit);
const remove = Ref.getFunctionReference(memory.remove);
const pause = Ref.getFunctionReference(memory.pause);
const clear = Ref.getFunctionReference(memory.clear);
const state = Ref.getFunctionReference(memory.state);
const search = Ref.getFunctionReference(memory.search);

const NOW = Date.UTC(2026, 9, 10, 12);
const LESSON = "lesson:material:lesson:mathematics:material-section:limits";
const rejected = (reason: "empty" | "missing") => ({
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

describe("Nina memory writes", () => {
  it("refuses a visitor on every write with the typed failure of a missing session, and changes nothing", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({
      author: "learner",
      text: "Kelas 11",
      title: "Sekolah",
    });
    const stored = await f.stored();
    const keys = await f.keys();
    for (const write of [
      () => f.t.mutation(add, { text: "A visitor's words" }),
      () => f.t.mutation(edit, { id, text: "A visitor's words" }),
      () => f.t.mutation(remove, { id }),
      () => f.t.mutation(pause, { paused: true }),
      () => f.t.mutation(clear, {}),
    ]) {
      await expect(write()).rejects.toMatchObject(sessionRequired);
    }
    // `toStrictEqual` compares the sealed bytes; `toEqual` takes any two buffers for equal.
    expect(await f.stored()).toStrictEqual(stored);
    expect(await f.keys()).toStrictEqual(keys);
    expect(await f.owner.query(state, {})).toEqual({ paused: false });
  });

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

  it("refuses a write with neither a title nor words, before it looks at the memory, and changes nothing", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({
      author: "learner",
      text: "Kelas 11",
      title: "Sekolah",
    });
    const gone = await f.seed();
    await f.owner.mutation(remove, { id: gone });
    const before = await f.stored();
    const keysBefore = await f.keys();
    vi.setSystemTime(NOW + 1000);
    // One memory is gone, and `empty` still comes first.
    for (const text of ["", "   ", "\n\t"]) {
      for (const call of [
        () => f.owner.mutation(add, { text }),
        () => f.owner.mutation(edit, { id, text }),
        () => f.owner.mutation(edit, { id: gone, text }),
      ]) {
        await expect(call()).rejects.toMatchObject(rejected("empty"));
      }
    }
    // `toStrictEqual` compares the sealed bytes; `toEqual` takes any two buffers for equal.
    expect(await f.stored()).toStrictEqual(before);
    expect(await f.keys()).toStrictEqual(keysBefore);
  });

  it("keeps the Markdown of a memory as the learner wrote it, when added and edited", async () => {
    const f = await createMemoryTest();
    const text = "## Tujuan\n\n- **SNBT** 2027\n- [ ] Latihan `peluang`";
    const id = await f.owner.mutation(add, { text });
    expect(await f.texts()).toEqual([text]);
    const edited = `${text}\n\n> Catatan`;
    await f.owner.mutation(edit, { id, text: edited });
    expect(await f.texts()).toEqual([edited]);
  });

  it("keeps adding memories, however many the learner has: there is no limit", async () => {
    const f = await createMemoryTest();
    await f.fill(150);
    const id = await f.owner.mutation(add, { text: "The 151st memory" });
    expect(await f.stored()).toHaveLength(151);
    expect(await f.owner.mutation(edit, { id, text: "Changed" })).toBeNull();
    expect(await f.texts()).toContain("Changed");
    expect(await f.texts()).toContain("Memory 0");
  });

  it("writes nothing when the vault cannot seal", async () => {
    const f = await createMemoryTest();
    vi.stubEnv("VAULT_ROOT_KEYS", "");
    await expect(
      f.owner.mutation(add, { text: "Never stored" })
    ).rejects.toThrow();
    expect(await f.stored()).toEqual([]);
    expect(await f.keys()).toEqual([]);
  });

  it("edits the words as the learner, keeping the kind, the topics and a situation's end", async () => {
    const f = await createMemoryTest();
    const validUntil = Date.UTC(2026, 9, 20, 23, 59, 59, 999);
    const id = await f.seed({
      kind: "situation",
      text: "Ulangan kimia",
      topics: [LESSON],
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
        topics: [LESSON],
        validUntil,
      }),
    ]);
    expect(await f.texts()).toEqual(["Ulangan kimia 20 Oktober"]);
    // The memory stays linked to its topic, and its keys follow its new words
    // and the time it was edited.
    const rows = await f.keys();
    expect(Arr.map(rows, (row) => row.key)).toContain(`t:${LESSON}`);
    expect(Arr.map(rows, (row) => row.confirmedAt)).toEqual(
      Arr.makeBy(Arr.length(rows), () => 5000)
    );
    expect(
      await f.find({ limit: 5, text: "oktober", topics: [LESSON] })
    ).toEqual(["Ulangan kimia 20 Oktober"]);
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
    const edited = async (fields: typeof NinaMemoryDraft.Type) => {
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
    // The title is found by its words, and the words that went are not.
    expect(await f.find({ limit: 5, text: "baru" })).toEqual([""]);
    expect(await f.find({ limit: 5, text: "lama kelas" })).toEqual([]);
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
    expect(await f.find({ limit: 5, text: "baru" })).toEqual([]);
  });

  it("refuses to edit a memory that is gone or another learner's, and ignores their removal", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    const gone = await f.seed();
    await f.owner.mutation(remove, { id: gone });
    const theirs = await other.owner.mutation(add, { text: "Rahasia mereka" });
    await expect(
      f.owner.mutation(edit, { id: gone, text: "Too late" })
    ).rejects.toMatchObject(rejected("missing"));
    await expect(
      f.owner.mutation(edit, { id: theirs, text: "Diubah" })
    ).rejects.toMatchObject(rejected("missing"));
    expect(await f.owner.mutation(remove, { id: theirs })).toBeNull();
    expect(await f.texts(other.userId)).toEqual(["Rahasia mereka"]);
  });

  it("indexes a memory the learner adds at the time it was added, so a search finds it", async () => {
    const f = await createMemoryTest();
    await f.owner.mutation(add, {
      text: "Belajar trigonometri",
      title: "Mapel",
    });
    expect(Arr.map(await f.keys(), (row) => row.confirmedAt)).toEqual([
      NOW,
      NOW,
      NOW,
    ]);
    for (const query of ["mapel", "trigonometry"]) {
      expect(
        Ref.decodeReturnsSync(
          memory.search,
          await f.owner.query(search, { query })
        )
      ).toEqual([expect.objectContaining({ text: "Belajar trigonometri" })]);
    }
  });
});
