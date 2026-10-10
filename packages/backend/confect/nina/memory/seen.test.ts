import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  changedSince,
  lostMemory,
} from "@repo/backend/confect/nina/memory/seen";
import { candidate, createCaptureTest } from "@repo/backend/test/nina/memory";
import { Array as Arr, Order, Schema } from "effect";

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
const third = decode("third");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** The memories a call found changed, in alphabetical order: a set keeps no order of its own. */
function changed(...args: Parameters<typeof changedSince>) {
  return Arr.sort(Arr.fromIterable(changedSince(...args)), Order.String);
}

describe("memory a capture call had read", () => {
  it("finds a memory that is gone, and nothing when all are there or none was read", () => {
    const stored = [{ _id: first, confirmedAt: 1 }];
    expect(lostMemory([{ confirmedAt: 1, id: first }], stored)).toBe(false);
    expect(lostMemory([], stored)).toBe(false);
    expect(lostMemory([], [])).toBe(false);
    expect(
      lostMemory(
        [
          { confirmedAt: 1, id: first },
          { confirmedAt: 1, id: second },
        ],
        stored
      )
    ).toBe(true);
  });

  it("finds the memories confirmed after the call read them, and those it never read", () => {
    expect(
      changed(
        [
          { confirmedAt: 1, id: first },
          { confirmedAt: 1, id: second },
        ],
        [
          { _id: first, confirmedAt: 5 },
          { _id: second, confirmedAt: 1 },
          { _id: third, confirmedAt: 9 },
        ]
      )
    ).toEqual([first, third]);
  });

  it("finds nothing when every stored memory is as the call read it, and every memory when it read none", () => {
    const stored = [
      { _id: first, confirmedAt: 1 },
      { _id: second, confirmedAt: 2 },
    ];
    expect(
      changed(
        [
          { confirmedAt: 2, id: second },
          { confirmedAt: 1, id: first },
        ],
        stored
      )
    ).toEqual([]);
    expect(changed([], stored)).toEqual([first, second]);
    expect(changed([], [])).toEqual([]);
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
