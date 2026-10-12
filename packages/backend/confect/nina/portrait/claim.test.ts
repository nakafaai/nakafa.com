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

  it("reads the lasting memories confirmed after what the portrait has read, the newest first, and the portrait as it stands", async () => {
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
        {
          confirmedAt: 7,
          id: style,
          text: "Lebih suka contoh soal dulu",
          title: "Gaya belajar",
        },
        { confirmedAt: 6, id: level, kind: "level", text: "Kelas 12 IPA" },
      ],
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
    expect(await claimAt(f)).toEqual({ memories: [], reached: 4, through: 4 });
  });

  it("reads from the first memory when the portrait has read nothing, at most forty, the newest", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait();
    await f.fill(45);
    const claimed = await claimAt(f);
    expect(claimed?.memories).toHaveLength(40);
    expect(claimed?.memories[0]?.text).toBe("Memory 44");
    expect(claimed?.memories[39]?.text).toBe("Memory 5");
    expect(claimed).toMatchObject({ reached: 45, through: 0 });
  });

  it("reads nothing that Delete all took, though a batch still holds it", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({ through: 2 });
    await f.fill(10);
    await f.markCleared(6);
    expect(texts(await claimAt(f))).toEqual([
      "Memory 9",
      "Memory 8",
      "Memory 7",
      "Memory 6",
    ]);
  });

  it("reads no memory of another learner", async () => {
    const f = await createPortraitTest();
    const other = await f.stranger();
    await f.seedPortrait();
    await f.seed({ confirmedAt: 5, text: "Not theirs", userId: other.userId });
    expect(await claimAt(f)).toEqual({ memories: [], reached: 0, through: 0 });
  });
});
