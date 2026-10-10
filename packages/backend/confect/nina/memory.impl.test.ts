import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { EXPIRY_PAGE } from "@repo/backend/confect/nina/memory/store";
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
const pause = Ref.getFunctionReference(memory.pause);
const clear = Ref.getFunctionReference(memory.clear);
const read = Ref.getFunctionReference(refs.internal.nina.memory.read);
const expire = Ref.getFunctionReference(refs.internal.nina.memory.expire);

const NOW = Date.UTC(2026, 9, 10, 12);
const LESSON = "material:lesson:mathematics:material-section:limits";
const rejected = (reason: "limit" | "missing") => ({
  data: { _tag: "NinaMemoryRejected", reason },
});

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
      // The learner writes pure text: the memory is theirs and has no kind.
      expect(row).toMatchObject({ author: "learner" });
      expect(row).not.toHaveProperty("kind");
    }
    expect(
      await f.t.query((ctx) => ctx.db.query("vaultKeys").collect())
    ).toHaveLength(1);
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

  it("treats a memory without its learner key as a defect", async () => {
    const f = await createMemoryTest();
    await f.seed();
    await f.t.mutation(async (ctx) => {
      for (const key of await ctx.db.query("vaultKeys").collect()) {
        await ctx.db.delete(key._id);
      }
    });
    await expect(f.owner.query(list, {})).rejects.toThrow();
  });
});

describe("Nina memory writes", () => {
  it("accepts words of 2000 characters and refuses 2001, or none, when added and when edited", async () => {
    const f = await createMemoryTest();
    // The test names the numbers, not the constant, so a change of the limit fails it.
    const id = await f.owner.mutation(add, { text: "x".repeat(2000) });
    for (const text of ["x".repeat(2001), "   ", ""]) {
      await expect(f.owner.mutation(add, { text })).rejects.toThrow();
      await expect(f.owner.mutation(edit, { id, text })).rejects.toThrow();
    }
    expect(
      await f.owner.mutation(edit, { id, text: "y".repeat(2000) })
    ).toBeNull();
    expect(await f.texts()).toEqual(["y".repeat(2000)]);
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

  it("refuses to edit a memory that is gone", async () => {
    const f = await createMemoryTest();
    const id = await f.seed();
    await f.owner.mutation(remove, { id });
    await expect(
      f.owner.mutation(edit, { id, text: "Too late" })
    ).rejects.toMatchObject(rejected("missing"));
  });

  it("removes one memory, and ignores a memory that is gone", async () => {
    const f = await createMemoryTest();
    const id = await f.seed({ text: "Goes" });
    await f.seed({ text: "Stays" });
    expect(await f.owner.mutation(remove, { id })).toBeNull();
    expect(await f.owner.mutation(remove, { id })).toBeNull();
    expect(await f.texts()).toEqual(["Stays"]);
  });

  it("clears every memory of the learner and no one else's", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.seed({ text: "Mine" });
    await f.seed({ author: "learner", text: "Also mine" });
    await f.seed({ text: "Theirs", userId: other.userId });
    expect(await f.owner.mutation(clear, {})).toBeNull();
    expect(await f.texts()).toEqual([]);
    expect(await f.texts(other.userId)).toEqual(["Theirs"]);
  });
});

describe("Nina memory pause", () => {
  it("pauses without deleting, resumes, and creates the preference only when it must", async () => {
    const f = await createMemoryTest();
    const preferences = () =>
      f.t.query((ctx) => ctx.db.query("learningPreferences").collect());
    const stranger = await f.stranger();
    expect(await stranger.owner.mutation(pause, { paused: false })).toBeNull();
    expect(await preferences()).toEqual([]);
    await f.seed({ author: "learner", text: "Kept" });
    vi.setSystemTime(1000);
    await f.owner.mutation(pause, { paused: true });
    expect(await preferences()).toEqual([
      expect.objectContaining({ ninaMemoryPaused: true, updatedAt: 1000 }),
    ]);
    vi.setSystemTime(2000);
    await f.owner.mutation(pause, { paused: true });
    expect(await preferences()).toEqual([
      expect.objectContaining({ ninaMemoryPaused: true, updatedAt: 1000 }),
    ]);
    const paused = await f.owner.query(list, {});
    expect(paused).toMatchObject({
      memories: [{ inUse: false, text: "Kept" }],
      paused: true,
    });
    expect(await f.t.query(read, { userId: f.identity.userId })).toMatchObject({
      known: [],
      paused: true,
      prompt: [],
    });
    expect(await f.stored()).toHaveLength(1);
    await f.owner.mutation(pause, { paused: false });
    const [resumed] = await preferences();
    expect(resumed?.ninaMemoryPaused).toBeUndefined();
    expect(resumed?.updatedAt).toBe(2000);
    expect(await f.owner.query(list, {})).toMatchObject({
      memories: [{ inUse: true }],
      paused: false,
    });
    expect(
      prompted(await f.t.query(read, { userId: f.identity.userId }))
    ).toEqual(["Kept"]);
  });

  it("keeps the learner's other preferences when it pauses and resumes", async () => {
    const f = await createMemoryTest();
    await f.t.mutation((ctx) =>
      ctx.db.insert("learningPreferences", {
        preferredTryoutCountryKey: "indonesia",
        updatedAt: 1,
        userId: f.identity.userId,
      })
    );
    await f.owner.mutation(pause, { paused: true });
    await f.owner.mutation(pause, { paused: false });
    expect(
      await f.t.query((ctx) => ctx.db.query("learningPreferences").collect())
    ).toEqual([
      expect.objectContaining({ preferredTryoutCountryKey: "indonesia" }),
    ]);
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
});

describe("Nina memory expiry", () => {
  it("deletes the situations whose end date has passed, and nothing else", async () => {
    const f = await createMemoryTest();
    await f.seed({ kind: "situation", text: "Ended", validUntil: NOW - 1 });
    await f.seed({ kind: "situation", text: "Today", validUntil: NOW + 1 });
    await f.seed({ author: "learner", text: "Open-ended" });
    await f.seed({ kind: "goal", text: "A goal" });
    expect(await f.t.mutation(expire, {})).toBe(1);
    expect(await f.texts()).toEqual(["Today", "Open-ended", "A goal"]);
    expect(await f.t.mutation(expire, {})).toBe(0);
  });

  it("goes on with the next page by itself while a page is full", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    for (const userId of [f.identity.userId, other.userId]) {
      await f.fill(EXPIRY_PAGE / 2 + 1, {
        kind: "situation",
        userId,
        validUntil: NOW - 1,
      });
    }
    await f.seed({ kind: "situation", text: "Later", validUntil: NOW + 1 });
    expect(await f.t.mutation(expire, {})).toBe(EXPIRY_PAGE);
    expect(await f.stored()).toHaveLength(3);
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.texts()).toEqual(["Later"]);
    expect(await f.stored()).toHaveLength(1);
  });
});
