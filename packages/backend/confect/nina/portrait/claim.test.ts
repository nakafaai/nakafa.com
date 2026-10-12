import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { claim, createPortraitTest } from "@repo/backend/test/nina/portrait";
import { Array as Arr, Option } from "effect";

const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);

const NOW = Date.UTC(2026, 9, 12, 12);
const QUIET = 30_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** Claims the build for the fixture's learner at `at`, a moment after the quiet of a request made at NOW unless the test says otherwise. */
async function claimAt(
  f: Awaited<ReturnType<typeof createPortraitTest>>,
  at = NOW + QUIET
) {
  vi.setSystemTime(at);
  return Ref.decodeReturnsSync(
    refs.internal.nina.portrait.claim,
    await f.t.mutation(claim, { userId: f.identity.userId })
  );
}

/** Moves on what the portrait has read, as a stored build does. */
function readThrough(
  f: Awaited<ReturnType<typeof createPortraitTest>>,
  through = 0
) {
  return f.t.mutation(async (ctx) => {
    const row = await ctx.db.query("ninaMemoryPortraits").first();
    if (row) {
      await ctx.db.patch(row._id, { through });
    }
  });
}

/** The words of each memory a claim hands on, in order. */
function texts(claimed: Awaited<ReturnType<typeof claimAt>>) {
  return Arr.map(
    Option.getOrThrow(Option.fromNullOr(claimed)).memories,
    (memory) => memory.text
  );
}

describe("claiming a portrait build", () => {
  it("claims nothing for a learner with no request", async () => {
    const f = await createPortraitTest();
    await f.seed({ confirmedAt: 5, text: "Kelas 12 IPA" });
    expect(await claimAt(f)).toBeNull();
    expect(await f.rows()).toEqual([]);
  });

  it("claims nothing until the request has had its quiet, and claims at the moment it is over", async () => {
    const f = await createPortraitTest();
    await f.seed({ confirmedAt: 5, text: "Kelas 12 IPA" });
    await f.seedPortrait({ scheduledAt: NOW });
    expect(await claimAt(f, NOW + QUIET - 1)).toBeNull();
    expect(await claimAt(f)).toMatchObject({ reached: 5, through: 0 });
  });

  it("moves the time of the request to now, so a build scheduled by an earlier request finds that its quiet is not over", async () => {
    const f = await createPortraitTest();
    await f.seed({ confirmedAt: 5, text: "Kelas 12 IPA" });
    await f.seedPortrait({ scheduledAt: NOW });
    expect(await claimAt(f)).not.toBeNull();
    expect(await f.rows()).toEqual([
      expect.objectContaining({ scheduledAt: NOW + QUIET, through: 0 }),
    ]);
    expect(await claimAt(f, NOW + QUIET + QUIET - 1)).toBeNull();
    expect(await claimAt(f, NOW + QUIET + QUIET)).not.toBeNull();
  });

  it("stamps the build that goes to the model, and not one that hands it nothing", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({ scheduledAt: NOW, through: 5 });
    await f.seed({
      confirmedAt: 9,
      kind: "situation",
      text: "Ujian kimia 20 Oktober",
      validUntil: NOW + 86_400_000,
    });
    expect(await claimAt(f)).toMatchObject({ memories: [], reached: 9 });
    const [open] = await f.rows();
    expect(open).toMatchObject({ scheduledAt: NOW + QUIET });
    expect(open).not.toHaveProperty("builtAt");
    await f.seed({ confirmedAt: 10, text: "Mau ikut SNBT 2027" });
    await claimAt(f, NOW + 2 * QUIET);
    expect(await f.rows()).toEqual([
      expect.objectContaining({ builtAt: NOW + 2 * QUIET }),
    ]);
  });

  it("claims nothing while memory is paused, and leaves the request as it was", async () => {
    const f = await createPortraitTest();
    await f.seed({ confirmedAt: 5, text: "Kelas 12 IPA" });
    await f.seedPortrait({ scheduledAt: NOW });
    await f.owner.mutation(pause, { paused: true });
    expect(await claimAt(f)).toBeNull();
    expect(await f.rows()).toEqual([
      expect.objectContaining({ scheduledAt: NOW }),
    ]);
  });

  it("claims nothing for an account that is going or gone", async () => {
    const f = await createPortraitTest();
    await f.seed({ confirmedAt: 5, text: "Kelas 12 IPA" });
    await f.seedPortrait({ scheduledAt: NOW });
    await f.t.mutation((ctx) =>
      ctx.db.patch(f.identity.userId, { deletionPreparedAt: NOW })
    );
    expect(await claimAt(f)).toBeNull();
    await f.t.mutation((ctx) => ctx.db.delete(f.identity.userId));
    expect(await claimAt(f)).toBeNull();
  });

  it("reads the lasting memories confirmed after what the portrait has read, the oldest first, and the portrait as it stands", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({ text: "Kelas 11.", through: 5 });
    await f.seed({ confirmedAt: 3, text: "Older than the portrait" });
    const level = await f.seed({
      confirmedAt: 6,
      kind: "level",
      text: "Kelas 12 IPA",
    });
    const style = await f.seed({
      author: "learner",
      confirmedAt: 7,
      text: "Lebih suka contoh soal dulu",
      title: "Gaya belajar",
    });
    expect(await claimAt(f)).toEqual({
      memories: [
        { confirmedAt: 6, id: level, kind: "level", text: "Kelas 12 IPA" },
        {
          confirmedAt: 7,
          id: style,
          text: "Lebih suka contoh soal dulu",
          title: "Gaya belajar",
        },
      ],
      more: false,
      portrait: "Kelas 11.",
      reached: 7,
      through: 5,
    });
  });

  it("counts a situation among what it has read and never hands it on", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({ through: 5 });
    await f.seed({ confirmedAt: 6, text: "Mau ikut SNBT 2027" });
    await f.seed({
      confirmedAt: 9,
      kind: "situation",
      text: "Ujian kimia 20 Oktober",
      validUntil: NOW + 86_400_000,
    });
    const claimed = await claimAt(f);
    expect(texts(claimed)).toEqual(["Mau ikut SNBT 2027"]);
    expect(claimed).toMatchObject({ reached: 9, through: 5 });
    expect(claimed).not.toHaveProperty("portrait");
  });

  it("stays where it was when nothing is newer, and has no portrait to hand on when there is no text", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({ through: 4 });
    await f.seed({ confirmedAt: 4, text: "Already read" });
    expect(await claimAt(f)).toEqual({
      memories: [],
      more: false,
      reached: 4,
      through: 4,
    });
  });

  it("reads the oldest forty from the first memory when the portrait has read nothing, and says that more remain", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait();
    await f.fill(45);
    const claimed = await claimAt(f);
    expect(claimed?.memories).toHaveLength(40);
    expect(claimed?.memories[0]?.text).toBe("Memory 0");
    expect(claimed?.memories[39]?.text).toBe("Memory 39");
    expect(claimed).toMatchObject({ more: true, reached: 40, through: 0 });
  });

  it("reads on from where the last page ended until none is left, so no memory is skipped", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait();
    await f.fill(85);
    const first = await claimAt(f, NOW + QUIET);
    await readThrough(f, first?.reached);
    const second = await claimAt(f, NOW + 2 * QUIET);
    await readThrough(f, second?.reached);
    const third = await claimAt(f, NOW + 3 * QUIET);
    expect([first?.more, second?.more, third?.more]).toEqual([
      true,
      true,
      false,
    ]);
    expect(
      Arr.map([first, second, third], (claimed) => texts(claimed).length)
    ).toEqual([40, 40, 5]);
    expect(
      Arr.flatMap([first, second, third], (claimed) => texts(claimed))
    ).toEqual(Arr.makeBy(85, (index) => `Memory ${index}`));
    expect(third?.reached).toBe(85);
  });

  it("keeps the memories confirmed at the same moment together: a page ends before a group that it would cut", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait();
    await f.fill(38);
    for (const text of ["Group A", "Group B", "Group C"]) {
      await f.seed({ confirmedAt: 39, text });
    }
    const first = await claimAt(f, NOW + QUIET);
    expect(first?.memories).toHaveLength(38);
    expect(first).toMatchObject({ more: true, reached: 38 });
    await readThrough(f, first?.reached);
    const second = await claimAt(f, NOW + 2 * QUIET);
    expect(texts(second)).toEqual(["Group A", "Group B", "Group C"]);
    expect(second).toMatchObject({ more: false, reached: 39 });
  });

  it("reads a group longer than a page as a page, because it cannot be kept together", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait();
    for (const index of Arr.range(0, 40)) {
      await f.seed({ confirmedAt: 7, text: `Same moment ${index}` });
    }
    const claimed = await claimAt(f);
    expect(claimed?.memories).toHaveLength(40);
    expect(claimed).toMatchObject({ more: true, reached: 7 });
  });

  it("reads nothing that Delete all took, though a batch still holds it", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({ through: 2 });
    await f.fill(10);
    await f.markCleared(6);
    expect(texts(await claimAt(f))).toEqual([
      "Memory 6",
      "Memory 7",
      "Memory 8",
      "Memory 9",
    ]);
  });

  it("reads the memories of the learner it claims for, and none of another learner", async () => {
    const f = await createPortraitTest();
    const other = await f.stranger();
    await f.seedPortrait();
    await f.seed({ confirmedAt: 5, text: "Mine" });
    await f.seed({ confirmedAt: 6, text: "Not mine", userId: other.userId });
    const claimed = await claimAt(f);
    expect(texts(claimed)).toEqual(["Mine"]);
    expect(claimed).toMatchObject({ more: false, reached: 5, through: 0 });
  });
});
