import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import type { NinaMemoryView } from "@repo/backend/confect/nina/memory.spec";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { Array as Arr } from "effect";

const memory = refs.public.nina.memory;
const list = Ref.getFunctionReference(memory.list);
const state = Ref.getFunctionReference(memory.state);
const add = Ref.getFunctionReference(memory.add);
const pause = Ref.getFunctionReference(memory.pause);
const clear = Ref.getFunctionReference(memory.clear);

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

/** The words of each memory on the pages of a learner's list, newest first. */
async function listed(learner: Learner, numItems: number) {
  return Arr.map(Arr.flatten(await pagesOf(learner, numItems)), (m) => m.text);
}

describe("Nina memory page", () => {
  it("shows a visitor nothing", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Rahasia limit" });
    expect(
      await f.t.query(list, { paginationOpts: { cursor: null, numItems: 10 } })
    ).toEqual({ continueCursor: "", isDone: true, page: [] });
    expect(await f.t.query(state, {})).toBeNull();
  });

  it("shows a learner who has no memory an empty page that is done, and memory that is on", async () => {
    const f = await createMemoryTest();
    expect(await pageOf(f.owner, 10)).toMatchObject({ isDone: true, page: [] });
    expect(await f.owner.query(state, {})).toEqual({ paused: false });
  });

  it("adds memories as the learner's pure text, sealed at rest, and lists them opened, the newest first", async () => {
    const f = await createMemoryTest();
    vi.setSystemTime(NOW + 1000);
    const level = await f.owner.mutation(add, { text: "Kelas 12 IPA" });
    vi.setSystemTime(NOW + 2000);
    await f.owner.mutation(add, { text: "Ikut SNBT 2027" });
    const { page } = await pageOf(f.owner, 10);
    expect(page).toEqual([
      {
        author: "learner",
        confirmedAt: NOW + 2000,
        createdAt: expect.any(Number),
        id: expect.any(String),
        text: "Ikut SNBT 2027",
      },
      {
        author: "learner",
        confirmedAt: NOW + 1000,
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
    vi.setSystemTime(NOW + 1000);
    const titled = await f.owner.mutation(add, {
      text: "Kelas 12 IPA",
      title: "Sekolah",
    });
    vi.setSystemTime(NOW + 2000);
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
  });

  // 120 memories make three pages, the last one short, which proves the order across
  // pages and the cap as well as more would; each memory is sealed, so 300 took over
  // five seconds on a loaded machine.
  it("pages through 120 memories in order, newest confirmation first, and never more than 50 to a page", async () => {
    const f = await createMemoryTest();
    await f.fill(120);
    const pages = await pagesOf(f.owner, 50);
    expect(Arr.map(pages, Arr.length)).toEqual([50, 50, 20]);
    const all = Arr.flatten(pages);
    expect(Arr.map(all, (item) => item.text)).toEqual(
      Arr.makeBy(120, (index) => `Memory ${119 - index}`)
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
    await f.owner.mutation(pause, { paused: false });
    expect(await f.owner.query(state, {})).toEqual({ paused: false });
  });
});

describe("Nina memory page after Delete all", () => {
  it("lists none of the memories that Delete all took, though a batch still holds them, and ends the list where they begin", async () => {
    const f = await createMemoryTest();
    await f.fill(8);
    await f.markCleared(4);
    // Memory 0 to 3 are confirmed at or before 4: only Memory 4 to 7 are left.
    const first = await pageOf(f.owner, 3);
    expect(Arr.map(first.page, (m) => m.text)).toEqual([
      "Memory 7",
      "Memory 6",
      "Memory 5",
    ]);
    expect(first.isDone).toBe(false);
    const second = await pageOf(f.owner, 3, first.continueCursor);
    expect(Arr.map(second.page, (m) => m.text)).toEqual(["Memory 4"]);
    expect(second.isDone).toBe(true);
    expect(await listed(f.owner, 3)).toEqual([
      "Memory 7",
      "Memory 6",
      "Memory 5",
      "Memory 4",
    ]);
  });

  it("lists an empty page that is done when every memory the learner has was taken", async () => {
    const f = await createMemoryTest();
    await f.fill(8);
    await f.markCleared(8);
    expect(await pageOf(f.owner, 3)).toMatchObject({ isDone: true, page: [] });
    expect(await f.owner.query(state, {})).toEqual({ paused: false });
  });

  it("ends the list at the first page that meets the memories Delete all took, and lists the memory written right after", async () => {
    const f = await createMemoryTest();
    await f.fill(60);
    await f.owner.mutation(clear, {});
    // The first batch deleted 25 and 35 wait for the batches: a page of ten
    // meets them at once, so the list ends there with nothing on it.
    expect(await f.stored()).toHaveLength(35);
    expect(await pageOf(f.owner, 10)).toMatchObject({ isDone: true, page: [] });
    vi.setSystemTime(NOW + 1);
    await f.owner.mutation(add, { text: "Written after" });
    expect(await listed(f.owner, 10)).toEqual(["Written after"]);
  });

  it("keeps the memories of another learner whole", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.fill(3);
    await f.fill(3, { userId: other.userId });
    await f.markCleared(3);
    expect(await listed(f.owner, 10)).toEqual([]);
    expect(await listed(other.owner, 10)).toEqual([
      "Memory 2",
      "Memory 1",
      "Memory 0",
    ]);
  });
});
