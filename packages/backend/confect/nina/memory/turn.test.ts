import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import type { NinaLearner } from "@repo/backend/confect/nina/memory.spec";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { Array as Arr } from "effect";

const memory = refs.public.nina.memory;
const pause = Ref.getFunctionReference(memory.pause);
const read = Ref.getFunctionReference(refs.internal.nina.memory.read);
const known = Ref.getFunctionReference(refs.internal.nina.memory.known);
const paused = Ref.getFunctionReference(refs.internal.nina.memory.paused);

const NOW = Date.UTC(2026, 9, 10, 12);
const LESSON = "lesson:material:lesson:mathematics:material-section:limits";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** The words and the title of each memory that a turn tells about. */
function titled(notes: (typeof NinaLearner.Type)["prompt"]) {
  return Arr.map(notes, ({ text, title }) => [text, title]);
}

/** The words of each memory, in the order they are told. */
function words(notes: (typeof NinaLearner.Type)["prompt"]) {
  return Arr.map(notes, (note) => note.text);
}

describe("Nina memory for a turn", () => {
  it("tells whether the learner paused memory, and follows the pause switch", async () => {
    const f = await createMemoryTest();
    const userId = f.identity.userId;
    expect(await f.t.query(paused, { userId })).toBe(false);
    await f.owner.mutation(pause, { paused: true });
    expect(await f.t.query(paused, { userId })).toBe(true);
    await f.owner.mutation(pause, { paused: false });
    expect(await f.t.query(paused, { userId })).toBe(false);
  });

  it("starts a turn with the memories for the open page, then the most recent, and no more than eight", async () => {
    const f = await createMemoryTest();
    const userId = f.identity.userId;
    await f.fill(10);
    await f.seed({
      confirmedAt: 0,
      text: "About the lesson",
      topics: [LESSON],
    });
    const open = await f.t.query(read, { now: NOW, topics: [LESSON], userId });
    expect(open.paused).toBe(false);
    expect(open.profile).toEqual({});
    expect(words(open.prompt)).toEqual([
      "About the lesson",
      ...Arr.makeBy(7, (index) => `Memory ${9 - index}`),
    ]);
    expect(open.prompt[0]).toEqual({
      confirmedAt: 0,
      id: expect.any(String),
      kind: "goal",
      text: "About the lesson",
    });
    expect(
      words((await f.t.query(read, { now: NOW, topics: [], userId })).prompt)
    ).toEqual(Arr.makeBy(8, (index) => `Memory ${9 - index}`));
  });

  it("tells the title of a memory that has one, and of no other, to Nina and to the capture call", async () => {
    const f = await createMemoryTest();
    await f.seed({
      author: "learner",
      confirmedAt: 3,
      text: "Kelas 12 IPA",
      title: "Sekolah",
    });
    await f.seed({
      author: "learner",
      confirmedAt: 2,
      text: "",
      title: "Ujian akhir",
    });
    await f.seed({ confirmedAt: 1, text: "Ikut SNBT 2027" });
    const userId = f.identity.userId;
    const learner = await f.t.query(read, { now: NOW, topics: [], userId });
    const capture = await f.t.query(known, {
      now: NOW,
      message: "Aku kelas 12 IPA di sekolah, ujian akhir, ikut SNBT",
      topics: [],
      userId,
    });
    for (const side of [learner.prompt, capture.known]) {
      expect(titled(side)).toEqual([
        ["Kelas 12 IPA", "Sekolah"],
        ["", "Ujian akhir"],
        ["Ikut SNBT 2027", undefined],
      ]);
      expect(side[2]).not.toHaveProperty("title");
      // A memory the learner wrote has no kind to tell.
      expect(side[0]).not.toHaveProperty("kind");
      expect(side[2]).toHaveProperty("kind", "goal");
    }
  });

  it("tells the capture call the memories that match the message and the open page best, at most twelve", async () => {
    const f = await createMemoryTest();
    const userId = f.identity.userId;
    await f.fill(20, { text: "Aku suka limit" });
    await f.seed({ confirmedAt: 0, text: "Tentang halaman", topics: [LESSON] });
    await f.seed({ confirmedAt: 99, text: "Tidak ada hubungannya" });
    const capture = await f.t.query(known, {
      now: NOW,
      message: "Aku mau belajar limit",
      topics: [LESSON],
      userId,
    });
    expect(capture.paused).toBe(false);
    expect(capture.profile).toEqual({});
    expect(Arr.length(capture.known)).toBe(12);
    // The memory linked to the page ranks first, though it is the oldest.
    expect(words(capture.known)).toEqual([
      "Tentang halaman",
      ...Arr.makeBy(11, () => "Aku suka limit"),
    ]);
  });

  it("tells nothing while memory is paused, and still tells the account", async () => {
    const f = await createMemoryTest();
    const userId = f.identity.userId;
    await f.t.mutation((ctx) =>
      ctx.db.insert("onboardingProfiles", {
        focus: "tryout",
        updatedAt: NOW,
        userId,
      })
    );
    await f.seed({ text: "Kept", topics: [LESSON] });
    await f.owner.mutation(pause, { paused: true });
    expect(
      await f.t.query(read, { now: NOW, topics: [LESSON], userId })
    ).toEqual({
      paused: true,
      profile: { focus: "tryout" },
      prompt: [],
    });
    expect(
      await f.t.query(known, {
        message: "kept",
        now: NOW,
        topics: [LESSON],
        userId,
      })
    ).toEqual({ known: [], paused: true, profile: { focus: "tryout" } });
    await f.owner.mutation(pause, { paused: false });
    expect(
      words((await f.t.query(read, { now: NOW, topics: [], userId })).prompt)
    ).toEqual(["Kept"]);
  });

  it("reads a bounded number of memories for 300: eight for the turn, twelve for the capture call, at most 24 for a search that asks for more", async () => {
    const f = await createMemoryTest();
    const userId = f.identity.userId;
    await f.fill(300);
    const newest = (count: number) =>
      Arr.makeBy(count, (index) => `Memory ${299 - index}`);
    expect(
      words(
        (await f.t.query(read, { now: NOW, topics: [LESSON], userId })).prompt
      )
    ).toEqual(newest(8));
    const capture = await f.t.query(known, {
      now: NOW,
      message: "memory",
      topics: [],
      userId,
    });
    expect(words(capture.known)).toEqual(newest(12));
    expect(Arr.length(await f.find({ limit: 30, text: "memory" }))).toBe(24);
  });
});

describe("Nina memory for a turn after Delete all", () => {
  it("reads nothing the learner deleted, by the pages of a lesson or by the newest, and tells that memory is on", async () => {
    const f = await createMemoryTest();
    const userId = f.identity.userId;
    await f.fill(3, { topics: [LESSON] });
    await f.markCleared(3);
    expect(
      await f.t.query(read, { now: NOW, topics: [LESSON], userId })
    ).toMatchObject({ paused: false, prompt: [] });
    expect(
      await f.t.query(known, {
        message: "memory",
        now: NOW,
        topics: [LESSON],
        userId,
      })
    ).toMatchObject({ known: [], paused: false });
  });

  it("reads the memories confirmed after the request, and only those", async () => {
    const f = await createMemoryTest();
    const userId = f.identity.userId;
    await f.fill(3, { topics: [LESSON] });
    await f.markCleared(3);
    await f.seed({ confirmedAt: 4, text: "Memory four", topics: [LESSON] });
    await f.seed({ confirmedAt: 5, text: "Memory five" });
    expect(
      words(
        (await f.t.query(read, { now: NOW, topics: [LESSON], userId })).prompt
      )
    ).toEqual(["Memory four", "Memory five"]);
    const capture = await f.t.query(known, {
      message: "memory",
      now: NOW,
      topics: [LESSON],
      userId,
    });
    expect(words(capture.known)).toEqual(["Memory four", "Memory five"]);
  });
});
