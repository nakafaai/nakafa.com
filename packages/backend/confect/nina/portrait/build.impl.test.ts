import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { deployment, provider } from "@repo/backend/test/gateway";
import { candidate, createCaptureTest } from "@repo/backend/test/nina/memory";
import {
  createPortraitTest,
  createRequestedTest,
  promptOf,
  scheduledBuilds,
  writes,
} from "@repo/backend/test/nina/portrait";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const memory = refs.public.nina.memory;
const add = Ref.getFunctionReference(memory.add);
const pause = Ref.getFunctionReference(memory.pause);

const NOW = Date.UTC(2026, 9, 12, 12);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  deployment.mockReset();
  provider.languageModel.mockReset();
  vi.useRealTimers();
});

describe("the scheduled portrait build", () => {
  it("runs after the quiet a memory the learner added asks for, and builds the portrait", async () => {
    const f = await createPortraitTest();
    await f.owner.mutation(add, { text: "Mau ikut SNBT 2027." });
    const model = writes("Mau ikut SNBT 2027.");
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(await f.portrait()).toBe("Mau ikut SNBT 2027.");
  });

  it("logs a missing gateway and builds nothing", async () => {
    const f = await createRequestedTest();
    await f.seed({ text: "Mau ikut SNBT 2027." });
    deployment.mockReturnValue(
      Effect.fail(
        new GatewayConfigurationError({
          message: "AI Gateway is not configured.",
        })
      )
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const model = writes("Never stored.");
    await f.runScheduled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "WARN",
        message: "Nina portrait configuration unavailable",
      })
    );
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.portrait()).toBeNull();
  });

  it("builds the portrait of the learner it was scheduled for, and leaves another learner who also asked for one alone", async () => {
    const f = await createRequestedTest();
    const other = await f.stranger();
    await f.seedPortrait({ scheduledAt: NOW, userId: other.userId });
    await f.seed({ text: "Mau ikut SNBT 2027." });
    await f.seed({ text: "Rahasia mereka.", userId: other.userId });
    const model = writes("Mau ikut SNBT 2027.");
    await f.runScheduled();
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(promptOf(model)).not.toContain("Rahasia");
    expect(await f.portrait()).toBe("Mau ikut SNBT 2027.");
    expect(await f.portrait(other.userId)).toBeNull();
    expect(await f.rows()).toContainEqual(
      expect.objectContaining({ scheduledAt: NOW, userId: other.userId })
    );
  });

  it("is asked for when a capture stores or confirms a memory, unless a build went to the model in the last day, and not when the capture stores none", async () => {
    const f = await createCaptureTest();
    expect(await f.run([])).toBe(0);
    expect(await scheduledBuilds(f)).toEqual([]);
    expect(await f.run([candidate()])).toBe(1);
    expect(await scheduledBuilds(f)).toEqual([{ userId: f.identity.userId }]);
    // A build went to the model. The same memory said again is confirmed, and
    // the day's build stands.
    await f.t.mutation(async (ctx) => {
      const row = await ctx.db.query("ninaMemoryPortraits").first();
      if (row) {
        await ctx.db.patch(row._id, { builtAt: NOW });
      }
    });
    expect(await f.run([candidate()])).toBe(1);
    expect(await scheduledBuilds(f)).toHaveLength(1);
  });

  it("makes one model call with every memory the learner adds within the quiet, and asks for none after the build went to the model", async () => {
    const f = await createPortraitTest();
    const model = writes("Ikut SNBT 2027, kelas 12 IPA, suka contoh soal.");
    for (const [seconds, text] of [
      [0, "Ikut SNBT 2027"],
      [20, "Kelas 12 IPA"],
      [40, "Suka contoh soal"],
    ] as const) {
      vi.setSystemTime(NOW + seconds * 1000);
      await f.owner.mutation(add, { text });
    }
    expect(await f.scheduled()).toHaveLength(3);
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(model.doGenerateCalls).toHaveLength(1);
    const prompt = promptOf(model);
    for (const text of ["Ikut SNBT 2027", "Kelas 12 IPA", "Suka contoh soal"]) {
      expect(prompt).toContain(`- ${text}`);
    }
    expect(await f.portrait()).toBe(
      "Ikut SNBT 2027, kelas 12 IPA, suka contoh soal."
    );
    // A memory added once the build has gone to the model waits for the day to
    // be over.
    const scheduled = (await f.scheduled()).length;
    await f.owner.mutation(add, { text: "Hobi main gitar" });
    expect(await f.scheduled()).toHaveLength(scheduled);
  });

  it("is not asked for by a capture while memory is paused", async () => {
    const f = await createCaptureTest();
    await f.owner.mutation(pause, { paused: true });
    expect(await f.run([candidate()])).toBe(0);
    expect(await scheduledBuilds(f)).toEqual([]);
  });

  it("builds the next page of memories after the one that asked for it, once it has had its quiet", async () => {
    const f = await createRequestedTest();
    await f.fill(45);
    const first = writes("Panjang.");
    await f.runScheduled();
    expect(promptOf(first)).toContain("Memory 39");
    expect(promptOf(first)).not.toContain("Memory 40");
    // The page that was stored asked for the next build, and the clock runs on
    // to it.
    const second = writes("Panjang dan baru.");
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(promptOf(second)).toContain("Memory 40");
    expect(promptOf(second)).not.toContain("Memory 39");
    expect(await f.portrait()).toBe("Panjang dan baru.");
    expect(await f.rows()).toEqual([expect.objectContaining({ through: 45 })]);
  });
});
