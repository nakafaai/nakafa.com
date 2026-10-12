import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import type { NinaUpkeepCall } from "@repo/backend/confect/nina/contract/usage";
import type { NinaMemorySeen } from "@repo/backend/confect/nina/memory.spec";
import { createPortraitTest, save } from "@repo/backend/test/nina/portrait";

const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);

const NOW = Date.UTC(2026, 9, 12, 12);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** A fixture whose learner has a portrait row that has read up to 5, and one memory confirmed at 6 that a build fed to the model. */
async function build(text?: string) {
  const f = await createPortraitTest();
  await f.seedPortrait({ ...(text === undefined ? {} : { text }), through: 5 });
  const id = await f.seed({ confirmedAt: 6, text: "Kelas 12 IPA" });
  /** Stores what a build wrote for that memory, unless the test says otherwise. */
  const store = (
    args: Partial<{
      expected: number;
      memories: (typeof NinaMemorySeen.Type)[];
      reached: number;
      text: string;
      usage: typeof NinaUpkeepCall.Type;
    }> = {}
  ) =>
    f.t.mutation(save, {
      expected: 5,
      memories: [{ confirmedAt: 6, id }],
      reached: 6,
      userId: f.identity.userId,
      ...args,
    });
  return { ...f, id, store };
}

describe("storing a portrait build", () => {
  it("stores the new text sealed, and moves on what the portrait has read", async () => {
    const f = await build("Kelas 11.");
    expect(await f.store({ text: "Kelas 12 IPA." })).toBe(true);
    expect(await f.portrait()).toBe("Kelas 12 IPA.");
    const [row] = await f.rows();
    expect(row).toMatchObject({ through: 6 });
    expect(new TextDecoder("latin1").decode(row?.text)).not.toContain("IPA");
  });

  it("stores a first portrait, for a row that has none", async () => {
    const f = await build();
    expect(await f.store({ text: "Kelas 12 IPA." })).toBe(true);
    expect(await f.portrait()).toBe("Kelas 12 IPA.");
  });

  it("adds the tokens of each call to the row, and counts the calls", async () => {
    const f = await build("Kelas 11.");
    expect(
      await f.store({
        text: "Kelas 12 IPA.",
        usage: { input: 900, output: 70 },
      })
    ).toBe(true);
    expect(await f.rows()).toEqual([
      expect.objectContaining({ usage: { calls: 1, input: 900, output: 70 } }),
    ]);
    expect(
      await f.store({
        expected: 6,
        memories: [],
        reached: 6,
        text: "Kelas 12 IPA, suka contoh soal.",
        usage: { input: 1100, output: 90 },
      })
    ).toBe(true);
    expect(await f.rows()).toEqual([
      expect.objectContaining({
        usage: { calls: 2, input: 2000, output: 160 },
      }),
    ]);
  });

  it("counts the tokens of a call whose text it does not store", async () => {
    const f = await build("Kelas 11.");
    await f.owner.mutation(pause, { paused: true });
    expect(
      await f.store({
        text: "Kelas 12 IPA.",
        usage: { input: 900, output: 70 },
      })
    ).toBe(false);
    expect(await f.portrait()).toBe("Kelas 11.");
    expect(await f.rows()).toEqual([
      expect.objectContaining({ usage: { calls: 1, input: 900, output: 70 } }),
    ]);
  });

  it("keeps the text when the build wrote none, and moves on only what it has read", async () => {
    const f = await build("Kelas 11.");
    const before = await f.rows();
    expect(await f.store({ memories: [], reached: 8 })).toBe(true);
    expect(await f.portrait()).toBe("Kelas 11.");
    expect((await f.rows())[0]).not.toHaveProperty("usage");
    expect(await f.rows()).toEqual([expect.objectContaining({ through: 8 })]);
    expect(await f.store({ expected: 8, memories: [], reached: 8 })).toBe(true);
    expect(await f.rows()).toEqual([
      expect.objectContaining({ _id: before[0]?._id, through: 8 }),
    ]);
  });

  it("takes the text out for an empty one and keeps the row while the learner has memories", async () => {
    const f = await build("Kelas 11.");
    expect(await f.store({ text: "" })).toBe(true);
    expect(await f.portrait()).toBeNull();
    expect(await f.rows()).toEqual([expect.objectContaining({ through: 6 })]);
  });

  it("deletes the row when no text remains and the learner has no memory at all", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({ through: 5 });
    expect(
      await f.t.mutation(save, {
        expected: 5,
        memories: [],
        reached: 5,
        userId: f.identity.userId,
      })
    ).toBe(true);
    expect(await f.rows()).toEqual([]);
  });

  it("writes nothing, and says so, when the portrait is gone, and does not make a new one", async () => {
    const f = await createPortraitTest();
    const id = await f.seed({ confirmedAt: 6, text: "Kelas 12 IPA" });
    expect(
      await f.t.mutation(save, {
        expected: 0,
        memories: [{ confirmedAt: 6, id }],
        reached: 6,
        text: "Kelas 12 IPA.",
        userId: f.identity.userId,
      })
    ).toBe(false);
    expect(await f.rows()).toEqual([]);
  });

  it.each([
    [
      "the portrait is not the one the plan read, because another build wrote or a memory was deleted or rewritten",
      async (f: Awaited<ReturnType<typeof build>>) => {
        await f.t.mutation(async (ctx) => {
          const row = await ctx.db.query("ninaMemoryPortraits").first();
          if (row) {
            await ctx.db.patch(row._id, { through: 0 });
          }
        });
      },
    ],
    [
      "memory is paused",
      async (f: Awaited<ReturnType<typeof build>>) => {
        await f.owner.mutation(pause, { paused: true });
      },
    ],
    [
      "a memory it fed to the model was deleted",
      async (f: Awaited<ReturnType<typeof build>>) => {
        await f.t.mutation((ctx) => ctx.db.delete(f.id));
      },
    ],
    [
      "a memory it fed to the model was confirmed or rewritten since",
      async (f: Awaited<ReturnType<typeof build>>) => {
        await f.t.mutation((ctx) => ctx.db.patch(f.id, { confirmedAt: 99 }));
      },
    ],
    [
      "the learner deleted every memory with Delete all, though a batch still holds it",
      async (f: Awaited<ReturnType<typeof build>>) => {
        await f.markCleared(10);
      },
    ],
  ])("writes nothing, and says so, when %s", async (_what, change) => {
    const f = await build("Kelas 11.");
    await change(f);
    const before = await f.rows();
    expect(await f.store({ text: "Kelas 12 IPA." })).toBe(false);
    // `toStrictEqual` compares the sealed bytes; `toEqual` takes any two buffers for equal.
    expect(await f.rows()).toStrictEqual(before);
  });
});
