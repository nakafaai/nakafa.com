import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { MEMORY_UNDO } from "@repo/backend/confect/nina/memory.spec";
import {
  createMemoryTest,
  sessionRequired,
} from "@repo/backend/test/nina/memory";
import { createPortraitTest } from "@repo/backend/test/nina/portrait";
import { Array as Arr, Duration, Option, Order, Struct } from "effect";

const memory = refs.public.nina.memory;
const add = Ref.getFunctionReference(memory.add);
const clear = Ref.getFunctionReference(memory.clear);
const list = Ref.getFunctionReference(memory.list);
const pause = Ref.getFunctionReference(memory.pause);
const remove = Ref.getFunctionReference(memory.remove);
const restore = Ref.getFunctionReference(memory.restore);
const expire = Ref.getFunctionReference(refs.internal.nina.memory.expire);

const NOW = Date.UTC(2026, 9, 10, 12);
/** The Undo is read from its one owner, the contract the page reads too. */
const UNDO = Duration.toMillis(MEMORY_UNDO);
const LESSON = "lesson:material:lesson:mathematics:material-section:limits";
/** What the page is told when there is nothing to put back for the learner. */
const missing = { data: { _tag: "NinaMemoryRejected", reason: "missing" } };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

type Fixture = Awaited<ReturnType<typeof createMemoryTest>>;

/** The stored memory row, which a test expects to exist. */
async function rowOf(f: Fixture, id: Parameters<Fixture["rowOf"]>[0]) {
  return Option.getOrThrow(Option.fromNullishOr(await f.rowOf(id)));
}

/** A row without what Convex gives a document on its own, to compare two rows field for field. */
function fieldsOf(row: Awaited<ReturnType<typeof rowOf>>) {
  return Struct.omit(row, ["_creationTime", "_id"]);
}

/** The key rows of one memory, as the keys and the time they hold, in key order. */
async function keysOf(f: Fixture, id: Parameters<Fixture["rowOf"]>[0]) {
  return Arr.sortWith(
    Arr.map(
      Arr.filter(await f.keys(), ({ memoryId }) => memoryId === id),
      ({ confirmedAt, key, userId }) => ({ confirmedAt, key, userId })
    ),
    ({ key }) => key,
    Order.String
  );
}

/** The page of the learner's memories that the Memory page reads first. */
async function listed(f: Fixture) {
  return Ref.decodeReturnsSync(
    memory.list,
    await f.owner.query(list, {
      paginationOpts: { cursor: null, numItems: 50 },
    })
  ).page;
}

/** The jobs a fixture has scheduled that have not run, by function. */
function scheduled(f: Fixture, name: string) {
  return f.t.query(async (ctx) =>
    Arr.filter(
      await ctx.db.system.query("_scheduled_functions").collect(),
      (job) => job.name === name
    )
  );
}

describe("Nina memory restore", () => {
  it("puts a situation Nina saved back with every field it had, its keys, and its place in the list", async () => {
    const f = await createMemoryTest();
    const validUntil = Date.UTC(2026, 9, 20, 23, 59, 59, 999);
    await f.seed({ confirmedAt: 3, text: "Older" });
    const id = await f.seed({
      confirmedAt: 5,
      kind: "situation",
      text: "Ulangan kimia 20 Oktober",
      topics: [LESSON],
      validUntil,
    });
    await f.seed({ confirmedAt: 8, text: "Newer" });
    const before = await rowOf(f, id);
    const keysBefore = await keysOf(f, id);

    expect(await f.owner.mutation(remove, { id })).toBeNull();
    expect(await f.rowOf(id)).toBeNull();
    expect(await keysOf(f, id)).toEqual([]);
    // The record holds the fields as stored, the keys, and the end of the Undo.
    expect(await f.restores()).toEqual([
      expect.objectContaining({
        expiresAt: NOW + UNDO,
        memoryId: id,
        userId: f.identity.userId,
      }),
    ]);

    vi.setSystemTime(NOW + 1000);
    const restored = await f.owner.mutation(restore, { id });

    // Convex gives the memory a new id and a new creation time. Every other
    // field is the stored one, down to the sealed bytes.
    expect(restored.id).not.toBe(id);
    expect(fieldsOf(await rowOf(f, restored.id))).toStrictEqual(
      fieldsOf(before)
    );
    expect(await keysOf(f, restored.id)).toEqual(keysBefore);
    expect(await f.restores()).toEqual([]);
    expect(restored).toMatchObject({
      author: "nina",
      confirmedAt: 5,
      text: "Ulangan kimia 20 Oktober",
      validUntil,
    });
    // It stands where it stood, and the page reads it as it reads the others.
    const page = await listed(f);
    expect(Arr.map(page, (item) => item.text)).toEqual([
      "Newer",
      "Ulangan kimia 20 Oktober",
      "Older",
    ]);
    expect(page[1]).toEqual(Ref.decodeReturnsSync(memory.restore, restored));
    // The index finds it again by its words and by its topic.
    expect(await f.find({ limit: 5, text: "kimia" })).toEqual([
      "Ulangan kimia 20 Oktober",
    ]);
    expect(await f.find({ limit: 5, topics: [LESSON] })).toEqual([
      "Ulangan kimia 20 Oktober",
    ]);
  });

  it("puts a memory the learner wrote back as the learner's, with its title and no kind or end", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({
      author: "learner",
      text: "Kelas 11",
      title: "Sekolah",
    });
    const before = await rowOf(f, id);

    await f.owner.mutation(remove, { id });
    const restored = await f.owner.mutation(restore, { id });

    const after = await rowOf(f, restored.id);
    expect(fieldsOf(after)).toStrictEqual(fieldsOf(before));
    expect(after).toMatchObject({ author: "learner" });
    for (const absent of ["kind", "topics", "validUntil"]) {
      expect(after).not.toHaveProperty(absent);
    }
    expect(restored).toMatchObject({
      author: "learner",
      text: "Kelas 11",
      title: "Sekolah",
    });
    expect(restored).not.toHaveProperty("validUntil");
    expect(await f.texts()).toEqual(["Kelas 11"]);
    expect(await f.titles()).toEqual(["Sekolah"]);
  });

  it("keeps a record only for a memory the learner deleted, and for no other deletion", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    const id = await f.seed({ text: "Mine" });
    const theirs = await f.seed({ text: "Theirs", userId: other.userId });
    const ended = await f.seed({
      kind: "situation",
      text: "Ended",
      validUntil: NOW - 1,
    });

    // A memory that is gone, or another learner's, deletes nothing and keeps nothing.
    await f.owner.mutation(remove, { id: theirs });
    expect(await f.restores()).toEqual([]);
    await f.owner.mutation(remove, { id });
    await f.owner.mutation(remove, { id });
    expect(await f.restores()).toHaveLength(1);

    // The daily job and Delete all keep no record of what they delete.
    expect(await f.t.mutation(expire, {})).toBe(1);
    expect(await f.rowOf(ended)).toBeNull();
    await f.seed({ text: "Cleared" });
    await f.owner.mutation(clear, {});
    expect(await f.texts()).toEqual([]);
    expect(await f.restores()).toHaveLength(1);
    expect(await f.texts(other.userId)).toEqual(["Theirs"]);
  });

  it("refuses another learner's id and a visitor, and keeps the record for its owner", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    const id = await f.seed({ text: "Mine" });
    const theirs = await f.seed({ text: "Theirs", userId: other.userId });
    await f.owner.mutation(remove, { id });
    await other.owner.mutation(remove, { id: theirs });

    await expect(other.owner.mutation(restore, { id })).rejects.toMatchObject(
      missing
    );
    await expect(
      f.owner.mutation(restore, { id: theirs })
    ).rejects.toMatchObject(missing);
    await expect(f.t.mutation(restore, { id })).rejects.toMatchObject(
      sessionRequired
    );
    expect(await f.texts()).toEqual([]);
    expect(await f.texts(other.userId)).toEqual([]);
    expect(await f.restores()).toHaveLength(2);

    // Each learner puts back their own.
    await f.owner.mutation(restore, { id });
    await other.owner.mutation(restore, { id: theirs });
    expect(await f.texts()).toEqual(["Mine"]);
    expect(await f.texts(other.userId)).toEqual(["Theirs"]);
    expect(await f.restores()).toEqual([]);
  });

  it("puts a memory back until the Undo ends and not at its end, and the record that outlived it waits for the job", async () => {
    const f = await createMemoryTest();
    const inside = await f.seed({ text: "Inside" });
    const outside = await f.seed({ text: "Outside" });
    await f.owner.mutation(remove, { id: inside });
    await f.owner.mutation(remove, { id: outside });

    vi.setSystemTime(NOW + UNDO - 1);
    await f.owner.mutation(restore, { id: inside });
    vi.setSystemTime(NOW + UNDO);
    await expect(
      f.owner.mutation(restore, { id: outside })
    ).rejects.toMatchObject(missing);
    expect(await f.texts()).toEqual(["Inside"]);
    expect(await f.restores()).toHaveLength(1);

    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.restores()).toEqual([]);
    expect(await f.texts()).toEqual(["Inside"]);
  });

  it("puts a memory back once, and the memory it put back is a new memory to delete and put back again", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({ author: "learner", text: "Once" });
    await f.owner.mutation(remove, { id });
    const restored = await f.owner.mutation(restore, { id });

    await expect(f.owner.mutation(restore, { id })).rejects.toMatchObject(
      missing
    );
    await expect(
      f.owner.mutation(restore, { id: restored.id })
    ).rejects.toMatchObject(missing);
    expect(await f.texts()).toEqual(["Once"]);

    await f.owner.mutation(remove, { id: restored.id });
    expect(await f.texts()).toEqual([]);
    const again = await f.owner.mutation(restore, { id: restored.id });
    expect(again.id).not.toBe(restored.id);
    expect(await f.texts()).toEqual(["Once"]);
  });

  it("schedules the deletion of the record for the end of the Undo, and the deletion is harmless when the record was used", async () => {
    const f = await createMemoryTest();
    const used = await f.seed({ text: "Used" });
    const unused = await f.seed({ text: "Unused" });
    await f.owner.mutation(remove, { id: used });
    await f.owner.mutation(remove, { id: unused });
    const records = await f.restores();

    const jobs = await scheduled(f, "nina/memory:purge");
    expect(jobs).toHaveLength(2);
    for (const job of jobs) {
      expect(job.scheduledTime).toBe(NOW + UNDO);
    }
    expect(Arr.map(jobs, ({ args }) => args)).toEqual(
      Arr.map(records, ({ _id }) => [{ id: _id }])
    );

    await f.owner.mutation(restore, { id: used });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.restores()).toEqual([]);
    expect(await f.texts()).toEqual(["Used"]);
  });

  it("does not put back a memory that Delete all took, but one written after it", async () => {
    const f = await createMemoryTest();
    const gone = await f.seed({ confirmedAt: 4, text: "Gone" });
    await f.seed({ confirmedAt: 5, text: "Taken by Delete all" });
    await f.owner.mutation(remove, { id: gone });

    // Delete all does not run the job that deletes the record, so it is the
    // memory that is refused: it was confirmed before the learner asked.
    vi.setSystemTime(NOW + 1000);
    await f.owner.mutation(clear, {});
    await expect(f.owner.mutation(restore, { id: gone })).rejects.toMatchObject(
      missing
    );
    expect(await f.restores()).toHaveLength(1);

    const written = await f.owner.mutation(add, { text: "Written after" });
    await f.owner.mutation(remove, { id: written });
    await f.owner.mutation(restore, { id: written });
    expect(await f.texts()).toEqual(["Written after"]);
  });

  it("puts a situation back even when its end day has passed meanwhile, and the daily job then deletes it like any ended situation", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({
      kind: "situation",
      text: "Ulangan kimia",
      validUntil: NOW + 2000,
    });
    await f.owner.mutation(remove, { id });

    vi.setSystemTime(NOW + 3000);
    await f.owner.mutation(restore, { id });
    expect(await f.texts()).toEqual(["Ulangan kimia"]);
    expect(await f.find({ limit: 5, now: NOW + 3000, text: "kimia" })).toEqual(
      []
    );
    expect(await f.t.mutation(expire, {})).toBe(1);
    expect(await f.texts()).toEqual([]);
  });

  it("puts a memory back while memory is paused, and asks for no portrait build", async () => {
    const f = await createPortraitTest();
    const id = await f.seed({ author: "learner", text: "Kelas 11" });
    await f.owner.mutation(pause, { paused: true });
    await f.owner.mutation(remove, { id });

    await f.owner.mutation(restore, { id });
    expect(await f.texts()).toEqual(["Kelas 11"]);
    expect(await f.rows()).toEqual([]);
    expect(await f.scheduled()).toEqual([]);
  });

  it("builds the portrait again from scratch when a memory comes back, though a build read on meanwhile", async () => {
    const f = await createPortraitTest();
    const id = await f.seed({
      author: "learner",
      confirmedAt: 2,
      text: "Kelas 11",
    });
    await f.seedPortrait({
      builtAt: NOW - 1000,
      text: "Kelas 11.",
      through: 4,
    });
    await f.owner.mutation(remove, { id });
    // A build went to the model after the deletion and read on from a later
    // moment, so it will never meet a memory confirmed at 2 again.
    await f.t.mutation(async (ctx) => {
      const row = await ctx.db.query("ninaMemoryPortraits").first();
      if (row) {
        await ctx.db.patch(row._id, { builtAt: NOW, through: 9 });
      }
    });

    await f.owner.mutation(restore, { id });
    const [row] = await f.rows();
    expect(row).toMatchObject({ scheduledAt: NOW, through: 0 });
    expect(row).not.toHaveProperty("builtAt");
    expect(row).not.toHaveProperty("text");
    expect(await f.scheduled()).toEqual([
      { userId: f.identity.userId },
      { userId: f.identity.userId },
    ]);
  });
});
