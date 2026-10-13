import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  isUnchanged,
  lostSeen,
  readNamed,
} from "@repo/backend/confect/nina/memory/seen";
import {
  candidate,
  createCaptureTest,
  situation,
} from "@repo/backend/test/nina/memory";
import { Effect, Option, Schema } from "effect";

const clear = Ref.getFunctionReference(refs.public.nina.memory.clear);
const edit = Ref.getFunctionReference(refs.public.nina.memory.edit);
const remove = Ref.getFunctionReference(refs.public.nina.memory.remove);

const NOW = Date.UTC(2026, 9, 10, 12);
/** A text, and the same text with one more word: not the same words, though they say the same thing. */
const SCHOOL = "Saya kelas 12 IPA di SMA Negeri 1 Bandung";
const SCHOOL_NOW = `${SCHOOL} sekarang`;

const decode = Schema.decodeUnknownSync(Id("ninaMemories"));
const first = decode("first");
const second = decode("second");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("memory a capture call had read", () => {
  it("finds a memory that is gone, and nothing when all are there or none was read", async () => {
    const f = await createCaptureTest();
    const stays = await f.seed({ text: "Stays" });
    const gone = await f.seed({ text: "Goes" });
    await f.owner.mutation(remove, { id: gone });
    const lost = (seen: Parameters<typeof lostSeen>[1]) =>
      f.execute(lostSeen(f.identity.userId, seen, undefined));
    expect(await lost([{ confirmedAt: 1, id: stays }])).toBe(false);
    expect(await lost([])).toBe(false);
    expect(
      await lost([
        { confirmedAt: 1, id: stays },
        { confirmedAt: 1, id: gone },
      ])
    ).toBe(true);
  });

  it("counts a memory of another learner as gone", async () => {
    const f = await createCaptureTest();
    const other = await f.stranger();
    const theirs = await f.seed({ text: "Theirs", userId: other.userId });
    expect(
      await f.execute(
        lostSeen(f.identity.userId, [{ confirmedAt: 1, id: theirs }], undefined)
      )
    ).toBe(true);
  });

  it("counts a memory that Delete all took as gone, though a batch still holds it, and keeps one confirmed after", async () => {
    const f = await createCaptureTest();
    const taken = await f.seed({ confirmedAt: 5, text: "Taken" });
    const later = await f.seed({ confirmedAt: 6, text: "Later" });
    const lost = (id: typeof taken, clearedAt: number | undefined) =>
      f.execute(
        lostSeen(f.identity.userId, [{ confirmedAt: 1, id }], clearedAt)
      );
    expect(await lost(taken, undefined)).toBe(false);
    expect(await lost(taken, 4)).toBe(false);
    expect(await lost(taken, 5)).toBe(true);
    expect(await lost(later, 5)).toBe(false);
  });

  it("reads the memory a candidate names by its place on the list, as it stands now", async () => {
    const f = await createCaptureTest();
    const read = await f.seed({ text: "Read" });
    const gone = await f.seed({ text: "Goes" });
    await f.seed({ text: "Unread" });
    // The list the call gave the model: two memories, the second removed since.
    const seen = [
      { confirmedAt: 1, id: read },
      { confirmedAt: 1, id: gone },
    ];
    await f.owner.mutation(remove, { id: gone });
    const named = (place: number | undefined, clearedAt?: number) =>
      f.execute(
        Effect.map(
          readNamed(f.identity.userId, seen, place, clearedAt),
          (found) => Option.getOrNull(Option.map(found, (row) => row._id))
        )
      );
    expect(await named(1)).toBe(read);
    // A memory that is gone, a place beyond the list, a place before it, a
    // memory the call never listed, and no name at all each name nothing.
    expect(await named(2)).toBeNull();
    expect(await named(3)).toBeNull();
    expect(await named(0)).toBeNull();
    expect(await named(-1)).toBeNull();
    expect(await named(undefined)).toBeNull();
    // A memory that Delete all took names nothing, though a batch still holds it.
    expect(await named(1, 0)).toBe(read);
    expect(await named(1, 1)).toBeNull();
  });

  it("tells a memory as the call read it from one that was confirmed after, or that the call never read", () => {
    const seen = [{ confirmedAt: 1, id: first }];
    expect(isUnchanged(seen, { _id: first, confirmedAt: 1 })).toBe(true);
    expect(isUnchanged(seen, { _id: first, confirmedAt: 5 })).toBe(false);
    expect(isUnchanged(seen, { _id: second, confirmedAt: 1 })).toBe(false);
    expect(isUnchanged([], { _id: first, confirmedAt: 1 })).toBe(false);
  });
});

describe("memory capture write after the learner changed their memory", () => {
  it("writes nothing when the learner removed a memory the call had read", async () => {
    const f = await createCaptureTest();
    const kept = await f.seed({ author: "learner", text: "Stays" });
    const gone = await f.seed({ text: "Mau ikut SNBT 2027" });
    const seen = [
      { confirmedAt: 1, id: kept },
      { confirmedAt: 1, id: gone },
    ];
    await f.owner.mutation(remove, { id: gone });
    expect(await f.run([candidate()], { seen })).toBe(0);
    expect(await f.texts()).toEqual(["Stays"]);
    expect(await f.remembered()).toBeUndefined();
  });

  it("writes nothing when the learner cleared their memory after the call read it", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({ text: "Mau ikut SNBT 2027" });
    await f.owner.mutation(clear, {});
    expect(await f.run([candidate()], { seen: [{ confirmedAt: 1, id }] })).toBe(
      0
    );
    expect(await f.stored()).toEqual([]);
  });

  it("writes nothing when Delete all took a memory the call had read, though a batch still holds it", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({ text: "Mau ikut SNBT 2027" });
    await f.markCleared(NOW - 1);
    expect(await f.run([candidate()], { seen: [{ confirmedAt: 1, id }] })).toBe(
      0
    );
    expect(await f.stored()).toEqual([
      expect.objectContaining({ _id: id, confirmedAt: 1 }),
    ]);
    expect(await f.remembered()).toBeUndefined();
  });

  it("writes when every memory the call had read is still there, and when it had read none", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({ kind: "goal", text: "Mau ikut SNBT 2027" });
    expect(await f.run([candidate()], { seen: [{ confirmedAt: 1, id }] })).toBe(
      1
    );
    expect(
      await f.run([candidate({ kind: "style", text: "Contoh dulu" })], {
        seen: [],
      })
    ).toBe(1);
    expect(await f.texts()).toEqual([
      "Mau ikut SNBT 2027",
      "Kelas 12 IPA.",
      "Contoh dulu",
    ]);
  });

  it("keeps the learner's edit made after the call read the memory, and gives the memory no kind", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({
      author: "learner",
      confirmedAt: 1,
      text: "Kelas 11.",
    });
    const seen = [{ confirmedAt: 1, id }];
    vi.setSystemTime(NOW + 1000);
    await f.owner.mutation(edit, { id, text: "Kelas 12 IPA" });
    vi.setSystemTime(NOW + 2000);
    // The candidate names the memory the call read. It confirms the memory and
    // takes nothing from it, since the learner has written it since.
    expect(await f.run([candidate({ known: 1 })], { seen })).toBe(1);
    expect(await f.texts()).toEqual(["Kelas 12 IPA"]);
    const [row] = await f.stored();
    expect(row).toMatchObject({ author: "learner", confirmedAt: NOW + 2000 });
    // A memory that changed since the call read it is not given the kind either.
    expect(row).not.toHaveProperty("kind");
  });

  it("keeps the kind and the end of a situation that the learner edited after the call read it", async () => {
    const f = await createCaptureTest();
    const validUntil = Date.UTC(2026, 9, 12, 23, 59, 59, 999);
    const id = await f.seed({
      confirmedAt: 1,
      kind: "situation",
      text: "Ulangan kimia",
      validUntil,
    });
    const seen = [{ confirmedAt: 1, id }];
    vi.setSystemTime(NOW + 1000);
    await f.owner.mutation(edit, { id, text: "Ulangan kimia hari Senin" });
    vi.setSystemTime(NOW + 2000);
    expect(
      await f.run(
        [
          situation({
            known: 1,
            text: "Ulangan kimia hari Senin.",
            until: "2026-10-25",
          }),
        ],
        { seen }
      )
    ).toBe(1);
    expect(await f.texts()).toEqual(["Ulangan kimia hari Senin"]);
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        author: "learner",
        confirmedAt: NOW + 2000,
        kind: "situation",
        validUntil,
      }),
    ]);
  });

  it("treats a memory of Nina's that was confirmed after the call read it as changed: it keeps its words though the candidate that names it says them differently", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({ confirmedAt: 2, kind: "level", text: SCHOOL });
    // The call read the memory when it was confirmed at 1, and it was said again since.
    expect(
      await f.run([candidate({ known: 1, text: SCHOOL_NOW })], {
        seen: [{ confirmedAt: 1, id }],
      })
    ).toBe(1);
    expect(await f.texts()).toEqual([SCHOOL]);
    expect(await f.stored()).toEqual([
      expect.objectContaining({ author: "nina", confirmedAt: NOW }),
    ]);
  });
});
