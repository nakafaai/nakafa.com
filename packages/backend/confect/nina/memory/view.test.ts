import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import type { NinaMemoryView } from "@repo/backend/confect/nina/memory.spec";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { Array as Arr } from "effect";

const memory = refs.public.nina.memory;
const list = Ref.getFunctionReference(memory.list);
const state = Ref.getFunctionReference(memory.state);
const search = Ref.getFunctionReference(memory.search);
const add = Ref.getFunctionReference(memory.add);
const pause = Ref.getFunctionReference(memory.pause);

const NOW = Date.UTC(2026, 9, 10, 12);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

type Learner = Awaited<ReturnType<typeof createMemoryTest>>["owner"];

/** One page of the Memory page as a learner's browser decodes it. */
async function pageOf(learner: Learner, numItems: number, cursor?: string) {
  return Ref.decodeReturnsSync(
    memory.list,
    await learner.query(list, {
      paginationOpts: { cursor: cursor ?? null, numItems },
    })
  );
}

/** Every page of the Memory page, from the first to the one that is done. */
async function pagesOf(learner: Learner, numItems: number) {
  let pages: readonly (readonly (typeof NinaMemoryView.Type)[])[] = [];
  let cursor: string | undefined;
  let done = false;
  while (!done) {
    const page = await pageOf(learner, numItems, cursor);
    pages = Arr.append(pages, page.page);
    cursor = page.continueCursor;
    done = page.isDone;
  }
  return pages;
}

/** The words of each memory found, in the order the search returns them. */
async function found(learner: Learner, query: string) {
  return Arr.map(
    Ref.decodeReturnsSync(
      memory.search,
      await learner.query(search, { query })
    ),
    (item) => item.text
  );
}

describe("Nina memory page", () => {
  it("shows a visitor nothing", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Rahasia limit" });
    expect(
      await f.t.query(list, { paginationOpts: { cursor: null, numItems: 10 } })
    ).toEqual({ continueCursor: "", isDone: true, page: [] });
    expect(await f.t.query(state, {})).toBeNull();
    expect(await f.t.query(search, { query: "limit" })).toEqual([]);
  });

  it("shows a learner who has no memory an empty page that is done, and memory that is on", async () => {
    const f = await createMemoryTest();
    expect(await pageOf(f.owner, 10)).toMatchObject({ isDone: true, page: [] });
    expect(await f.owner.query(state, {})).toEqual({ paused: false });
    expect(await found(f.owner, "limit")).toEqual([]);
  });

  it("adds memories as the learner's pure text, sealed at rest, and lists them opened, the newest first", async () => {
    const f = await createMemoryTest();
    vi.setSystemTime(1000);
    const level = await f.owner.mutation(add, { text: "Kelas 12 IPA" });
    vi.setSystemTime(2000);
    await f.owner.mutation(add, { text: "Ikut SNBT 2027" });
    const { page } = await pageOf(f.owner, 10);
    expect(page).toEqual([
      {
        author: "learner",
        confirmedAt: 2000,
        createdAt: expect.any(Number),
        id: expect.any(String),
        text: "Ikut SNBT 2027",
      },
      {
        author: "learner",
        confirmedAt: 1000,
        createdAt: expect.any(Number),
        id: level,
        text: "Kelas 12 IPA",
      },
    ]);
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
    expect(page[0]).not.toHaveProperty("title");
    expect(
      await f.t.query((ctx) => ctx.db.query("vaultKeys").collect())
    ).toHaveLength(1);
  });

  it("lists a memory with a title and words, and a memory that is only a title with no words", async () => {
    const f = await createMemoryTest();
    vi.setSystemTime(1000);
    const titled = await f.owner.mutation(add, {
      text: "Kelas 12 IPA",
      title: "Sekolah",
    });
    vi.setSystemTime(2000);
    await f.owner.mutation(add, { text: "", title: "Ujian akhir" });
    const { page } = await pageOf(f.owner, 10);
    expect(Arr.map(page, (item) => [item.text, item.title])).toEqual([
      ["", "Ujian akhir"],
      ["Kelas 12 IPA", "Sekolah"],
    ]);
    expect(page[1]).toMatchObject({ id: titled });
    const [row] = await f.stored();
    expect(row?.title).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder("latin1").decode(row?.title)).not.toContain(
      "Sekolah"
    );
  });

  it("shows a memory Nina wrote as its words and end day, without its kind", async () => {
    const f = await createMemoryTest();
    await f.seed({
      kind: "situation",
      text: "Ulangan kimia",
      validUntil: NOW + 1,
    });
    expect((await pageOf(f.owner, 10)).page).toEqual([
      {
        author: "nina",
        confirmedAt: 1,
        createdAt: expect.any(Number),
        id: expect.any(String),
        text: "Ulangan kimia",
        validUntil: NOW + 1,
      },
    ]);
  });

  it("keeps each learner's memories apart", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await other.owner.mutation(add, { text: "Rahasia mereka limit" });
    await f.owner.mutation(add, { text: "Punyaku limit" });
    expect(Arr.map((await pageOf(f.owner, 10)).page, (m) => m.text)).toEqual([
      "Punyaku limit",
    ]);
    expect(
      Arr.map((await pageOf(other.owner, 10)).page, (m) => m.text)
    ).toEqual(["Rahasia mereka limit"]);
    expect(await found(f.owner, "limit")).toEqual(["Punyaku limit"]);
    expect(await found(other.owner, "limit")).toEqual(["Rahasia mereka limit"]);
  });

  it("pages through 300 memories in order, newest confirmation first, and never more than 50 to a page", async () => {
    const f = await createMemoryTest();
    await f.fill(300);
    const pages = await pagesOf(f.owner, 50);
    expect(Arr.every(pages, (page) => Arr.length(page) <= 50)).toBe(true);
    const all = Arr.flatten(pages);
    expect(Arr.map(all, (item) => item.text)).toEqual(
      Arr.makeBy(300, (index) => `Memory ${299 - index}`)
    );
    // However many the browser asks for, a page holds 50.
    expect(Arr.length((await pageOf(f.owner, 1000)).page)).toBe(50);
    expect(Arr.length((await pageOf(f.owner, 7)).page)).toBe(7);
  });

  it("lists the memories of a learner who paused memory, and says so", async () => {
    const f = await createMemoryTest();
    await f.seed({ author: "learner", text: "Kept" });
    await f.owner.mutation(pause, { paused: true });
    expect(await f.owner.query(state, {})).toEqual({ paused: true });
    expect(Arr.map((await pageOf(f.owner, 10)).page, (m) => m.text)).toEqual([
      "Kept",
    ]);
    expect(await found(f.owner, "kept")).toEqual(["Kept"]);
    await f.owner.mutation(pause, { paused: false });
    expect(await f.owner.query(state, {})).toEqual({ paused: false });
  });
});

describe("Nina memory page search", () => {
  it("finds a memory by what the learner types, trimmed, and nothing by an empty search", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Kelas 12 IPA", title: "Sekolah" });
    await f.seed({ text: "Ikut SNBT 2027" });
    expect(await found(f.owner, "  sekolah  ")).toEqual(["Kelas 12 IPA"]);
    expect(await found(f.owner, "snbt")).toEqual(["Ikut SNBT 2027"]);
    expect(await found(f.owner, "")).toEqual([]);
    expect(await found(f.owner, "   ")).toEqual([]);
  });

  it("shows a found memory as the Memory page shows it", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({
      author: "learner",
      confirmedAt: 7,
      text: "Kelas 12 IPA",
      title: "Sekolah",
    });
    const [item, ...others] = Ref.decodeReturnsSync(
      memory.search,
      await f.owner.query(search, { query: "ipa" })
    );
    expect(others).toEqual([]);
    expect(item).toEqual({
      author: "learner",
      confirmedAt: 7,
      createdAt: expect.any(Number),
      id,
      text: "Kelas 12 IPA",
      title: "Sekolah",
    });
  });

  it("accepts a search of 80 characters and refuses 81", async () => {
    const f = await createMemoryTest();
    // The test names the numbers, not the constant, so a change of the limit fails it.
    expect(await found(f.owner, "x".repeat(80))).toEqual([]);
    await expect(
      f.owner.query(search, { query: "x".repeat(81) })
    ).rejects.toThrow();
  });

  it("returns at most 30 memories", async () => {
    const f = await createMemoryTest();
    await f.fill(24, { text: "alfa" });
    await f.fill(24, { text: "beta" });
    expect(Arr.length(await found(f.owner, "alfa beta"))).toBe(30);
  });
});
