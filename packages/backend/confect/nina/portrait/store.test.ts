import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  dropPortrait,
  PORTRAIT_FIELD,
  requestPortrait,
} from "@repo/backend/confect/nina/portrait/store";
import { createPortraitTest } from "@repo/backend/test/nina/portrait";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 9, 12, 12);
const HOUR = 3_600_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** A request for a portrait build from the fixture's learner. */
function ask(
  f: Awaited<ReturnType<typeof createPortraitTest>>,
  options: { readonly paused?: boolean; readonly reset?: boolean } = {}
) {
  return f.execute(
    requestPortrait({
      paused: false,
      reset: false,
      userId: f.identity.userId,
      ...options,
    })
  );
}

describe("a request for a portrait build", () => {
  it("creates the row of a learner who has none and schedules one build", async () => {
    const f = await createPortraitTest();
    await ask(f);
    const [row] = await f.rows();
    expect(row).toMatchObject({
      scheduledAt: NOW,
      through: 0,
      userId: f.identity.userId,
    });
    expect(row).not.toHaveProperty("text");
    expect(await f.rows()).toHaveLength(1);
    expect(await f.scheduled()).toEqual([{ userId: f.identity.userId }]);
  });

  it("asks for nothing when memories are only added within a day of a build that went to the model, and asks again when the day is over", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({ builtAt: NOW, scheduledAt: NOW });
    vi.setSystemTime(NOW + 24 * HOUR - 1);
    await ask(f);
    expect(await f.scheduled()).toEqual([]);
    expect(await f.rows()).toEqual([
      expect.objectContaining({ builtAt: NOW, scheduledAt: NOW }),
    ]);
    vi.setSystemTime(NOW + 24 * HOUR);
    await ask(f);
    expect(await f.scheduled()).toHaveLength(1);
    expect(await f.rows()).toEqual([
      expect.objectContaining({ builtAt: NOW, scheduledAt: NOW + 24 * HOUR }),
    ]);
  });

  it("asks for every memory added before a build has gone to the model, so the quiet counts from the last of them", async () => {
    const f = await createPortraitTest();
    await ask(f);
    vi.setSystemTime(NOW + 20_000);
    await ask(f);
    vi.setSystemTime(NOW + 40_000);
    await ask(f);
    expect(await f.scheduled()).toHaveLength(3);
    expect(await f.rows()).toEqual([
      expect.objectContaining({ scheduledAt: NOW + 40_000 }),
    ]);
  });

  it("is not closed for a day by a request that no build answered", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({ scheduledAt: NOW - HOUR });
    await ask(f);
    expect(await f.scheduled()).toHaveLength(1);
    expect(await f.rows()).toEqual([
      expect.objectContaining({ scheduledAt: NOW }),
    ]);
  });

  it("keeps the text and what it has read when a memory is only added", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({ text: "Kelas 12.", through: 7 });
    await ask(f);
    expect(await f.portrait()).toBe("Kelas 12.");
    expect(await f.rows()).toEqual([
      expect.objectContaining({ scheduledAt: NOW, through: 7 }),
    ]);
    expect(await f.scheduled()).toHaveLength(1);
  });

  it("takes the text out at once and asks for a build from scratch when a memory is deleted or rewritten, whatever the last build was", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({
      builtAt: NOW - HOUR,
      scheduledAt: NOW - HOUR,
      text: "Kelas 12.",
      through: 7,
    });
    await ask(f, { reset: true });
    const [row] = await f.rows();
    expect(row).toMatchObject({
      builtAt: NOW - HOUR,
      scheduledAt: NOW,
      through: 0,
    });
    expect(row).not.toHaveProperty("text");
    expect(await f.portrait()).toBeNull();
    expect(await f.scheduled()).toHaveLength(1);
    // Another save a moment later asks again, because only the last request
    // finds that its quiet has come.
    vi.setSystemTime(NOW + 3000);
    await ask(f, { reset: true });
    expect(await f.scheduled()).toHaveLength(2);
    expect(await f.rows()).toEqual([
      expect.objectContaining({ scheduledAt: NOW + 3000 }),
    ]);
  });

  it("asks for a build when a memory is deleted and the learner has no row", async () => {
    const f = await createPortraitTest();
    await ask(f, { reset: true });
    expect(await f.rows()).toEqual([
      expect.objectContaining({ scheduledAt: NOW }),
    ]);
    expect(await f.scheduled()).toHaveLength(1);
  });

  it("asks for nothing while memory is paused, and creates no row", async () => {
    const f = await createPortraitTest();
    await ask(f, { paused: true });
    expect(await f.rows()).toEqual([]);
    expect(await f.scheduled()).toEqual([]);
  });

  it("takes the text out of a paused learner's portrait on a reset and builds nothing, and the first request after they resume asks at once", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({
      builtAt: NOW - HOUR,
      scheduledAt: NOW - HOUR,
      text: "Kelas 12.",
      through: 7,
    });
    await ask(f, { paused: true, reset: true });
    const [row] = await f.rows();
    expect(row).toMatchObject({ scheduledAt: NOW - HOUR, through: 0 });
    expect(row).not.toHaveProperty("text");
    expect(row).not.toHaveProperty("builtAt");
    expect(await f.scheduled()).toEqual([]);
    await ask(f);
    expect(await f.scheduled()).toHaveLength(1);
  });

  it("leaves a paused learner without a row alone on a reset", async () => {
    const f = await createPortraitTest();
    await ask(f, { paused: true, reset: true });
    expect(await f.rows()).toEqual([]);
  });
});

describe("a learner's portrait", () => {
  it("is stored sealed and read opened", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({ text: "Menyukai contoh soal." });
    const [row] = await f.rows();
    expect(new TextDecoder("latin1").decode(row?.text)).not.toContain("contoh");
    expect(await f.portrait()).toBe("Menyukai contoh soal.");
    expect(PORTRAIT_FIELD).toEqual({
      field: "text",
      table: "ninaMemoryPortraits",
    });
  });

  it("is nothing for a learner who has no row or no text", async () => {
    const f = await createPortraitTest();
    expect(await f.portrait()).toBeNull();
    await f.seedPortrait();
    expect(await f.portrait()).toBeNull();
  });

  it("is deleted with its row, for that learner alone", async () => {
    const f = await createPortraitTest();
    const other = await f.stranger();
    await f.seedPortrait({ text: "Kelas 12." });
    await f.seedPortrait({ text: "Kelas 11.", userId: other.userId });
    expect(await f.execute(dropPortrait(f.identity.userId))).toBe(true);
    expect(await f.execute(dropPortrait(f.identity.userId))).toBe(false);
    expect(Arr.map(await f.rows(), (row) => row.userId)).toEqual([
      other.userId,
    ]);
    expect(await f.portrait(other.userId)).toBe("Kelas 11.");
  });
});
