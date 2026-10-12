import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  isUnchanged,
  lostSeen,
  readNamed,
} from "@repo/backend/confect/nina/memory/seen";
import { candidate, createCaptureTest } from "@repo/backend/test/nina/memory";
import { Effect, Option, Schema } from "effect";

const clear = Ref.getFunctionReference(refs.public.nina.memory.clear);
const edit = Ref.getFunctionReference(refs.public.nina.memory.edit);
const remove = Ref.getFunctionReference(refs.public.nina.memory.remove);

const NOW = Date.UTC(2026, 9, 10, 12);
/** Nine words, and a text that has them all and one more: they say the same, in other words. */
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

  it("reads the memory a candidate names as it stands, only when the call read it", async () => {
    const f = await createCaptureTest();
    const read = await f.seed({ text: "Read" });
    const unread = await f.seed({ text: "Unread" });
    const gone = await f.seed({ text: "Goes" });
    const seen = [
      { confirmedAt: 1, id: read },
      { confirmedAt: 1, id: gone },
    ];
    await f.owner.mutation(remove, { id: gone });
    const named = (known: string | undefined, clearedAt?: number) =>
      f.execute(
        Effect.map(
          readNamed(f.identity.userId, seen, known, clearedAt),
          (found) => Option.getOrNull(Option.map(found, (row) => row._id))
        )
      );
    expect(await named(read)).toBe(read);
    // A memory the call did not read, one that is gone, one that is no id, and
    // no name at all each name nothing.
    expect(await named(unread)).toBeNull();
    expect(await named(gone)).toBeNull();
    expect(await named("not-an-id")).toBeNull();
    expect(await named(undefined)).toBeNull();
    // A memory that Delete all took names nothing, though a batch still holds it.
    expect(await named(read, 0)).toBe(read);
    expect(await named(read, 1)).toBeNull();
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
    // The candidate says what the learner wrote since. It confirms the memory
    // and takes nothing from it.
    expect(await f.run([candidate({ known: id })], { seen })).toBe(1);
    expect(await f.texts()).toEqual(["Kelas 12 IPA"]);
    const [row] = await f.stored();
    expect(row).toMatchObject({ author: "learner", confirmedAt: NOW + 2000 });
    // A memory that changed since the call read it is not given the kind either.
    expect(row).not.toHaveProperty("kind");
  });

  it("keeps the learner's edit made after the call read the memory when the candidate says something else, and writes a memory of Nina's", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({
      author: "learner",
      confirmedAt: 1,
      text: "Kelas 11.",
    });
    const seen = [{ confirmedAt: 1, id }];
    vi.setSystemTime(NOW + 1000);
    await f.owner.mutation(edit, { id, text: "Kelas 12 SMA" });
    vi.setSystemTime(NOW + 2000);
    expect(await f.run([candidate({ known: id })], { seen })).toBe(1);
    expect(await f.texts()).toEqual(["Kelas 12 SMA", "Kelas 12 IPA."]);
    const [edited, written] = await f.stored();
    expect(edited).toMatchObject({
      author: "learner",
      confirmedAt: NOW + 1000,
    });
    expect(edited).not.toHaveProperty("kind");
    expect(written).toMatchObject({
      author: "nina",
      confirmedAt: NOW + 2000,
      kind: "level",
    });
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
          candidate({
            kind: "situation",
            known: id,
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

  it("treats a memory that the call did not read at all as changed: a memory of Nina's keeps its words though a candidate says nearly the same", async () => {
    const f = await createCaptureTest();
    const read = await f.seed({ kind: "goal", text: "Mau ikut SNBT 2027" });
    await f.seed({ confirmedAt: 2, kind: "level", text: SCHOOL });
    // The call read the first memory and not the second, which was written after.
    expect(
      await f.run([candidate({ text: SCHOOL_NOW })], {
        seen: [{ confirmedAt: 1, id: read }],
      })
    ).toBe(1);
    expect(await f.texts()).toEqual(["Mau ikut SNBT 2027", SCHOOL]);
    expect(await f.stored()).toEqual([
      expect.objectContaining({ confirmedAt: 1 }),
      expect.objectContaining({ author: "nina", confirmedAt: NOW }),
    ]);
  });

  it("treats a memory the learner added after the call read what it knows as changed: it takes no kind and no end", async () => {
    const f = await createCaptureTest();
    const read = await f.seed({ author: "learner", text: "Kelas 12 IPA" });
    const added = await f.seed({ author: "learner", text: "Ulangan kimia" });
    const situation = candidate({
      kind: "situation",
      text: "Ulangan kimia.",
      until: "2026-10-25",
    });
    expect(
      await f.run([candidate({ known: read }), situation], {
        seen: [{ confirmedAt: 1, id: read }],
      })
    ).toBe(2);
    const [fresh, late] = await f.stored();
    // The memory the call read takes the kind. The one added after is only confirmed.
    expect(fresh).toMatchObject({ _id: read, kind: "level" });
    expect(late).toMatchObject({
      _id: added,
      author: "learner",
      confirmedAt: NOW,
    });
    expect(late).not.toHaveProperty("kind");
    expect(late).not.toHaveProperty("validUntil");
    expect(await f.texts()).toEqual(["Kelas 12 IPA", "Ulangan kimia"]);
  });
});
