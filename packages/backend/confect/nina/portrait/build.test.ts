import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { deployment, provider } from "@repo/backend/test/gateway";
import { fails } from "@repo/backend/test/nina/capture";
import {
  createPortraitTest,
  createRequestedTest,
  promptOf,
  writes,
  writesAfter,
  writesUncounted,
} from "@repo/backend/test/nina/portrait";
import { encodeJsonText } from "@repo/utilities/json";
import { APICallError } from "ai";
import { MutableRef } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const memory = refs.public.nina.memory;
const clear = Ref.getFunctionReference(memory.clear);
const edit = Ref.getFunctionReference(memory.edit);
const pause = Ref.getFunctionReference(memory.pause);
const remove = Ref.getFunctionReference(memory.remove);

const NOW = Date.UTC(2026, 9, 12, 12);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  deployment.mockReset();
  provider.languageModel.mockReset();
  vi.useRealTimers();
});

/** The log entry of a build that saved nothing. */
const unavailable = (fact: object) => [
  ["Nina portrait unavailable", expect.objectContaining(fact)],
];

describe("a portrait build", () => {
  it("writes a first portrait from the learner's memories, the oldest first, each as its title and words", async () => {
    const f = await createRequestedTest();
    await f.seed({ confirmedAt: 1, text: "Mau ikut SNBT 2027." });
    await f.seed({
      author: "learner",
      confirmedAt: 2,
      text: "Lebih suka contoh soal dulu.",
      title: "Gaya belajar",
    });
    const model = writes("Mau ikut SNBT 2027 dan lebih suka contoh soal dulu.");
    await f.build();
    expect(await f.portrait()).toBe(
      "Mau ikut SNBT 2027 dan lebih suka contoh soal dulu."
    );
    // The model reported 12 input and 4 output tokens for its one call.
    expect(await f.rows()).toEqual([
      expect.objectContaining({
        through: 2,
        usage: { calls: 1, input: 12, output: 4 },
      }),
    ]);
    const prompt = promptOf(model);
    expect(prompt).toContain("# Current Portrait\\n\\nNone yet.");
    expect(prompt).toContain("- Gaya belajar: Lebih suka contoh soal dulu.");
    expect(prompt.indexOf("Mau ikut SNBT 2027.")).toBeLessThan(
      prompt.indexOf("Gaya belajar")
    );
    expect(MutableRef.get(f.logged)).toEqual([]);
  });

  it("counts the tokens of a call as none when the provider reports none, and still counts the call", async () => {
    const f = await createRequestedTest();
    await f.seed({ text: "Mau ikut SNBT 2027." });
    writesUncounted("Mau ikut SNBT 2027.");
    await f.build();
    expect(await f.rows()).toEqual([
      expect.objectContaining({ usage: { calls: 1, input: 0, output: 0 } }),
    ]);
  });

  it("reads only the memories newer than the portrait and hands it the portrait it has", async () => {
    const f = await createRequestedTest({
      text: "Siap SNBT 2027.",
      through: 2,
    });
    await f.seed({ confirmedAt: 1, text: "Mau ikut SNBT 2027." });
    await f.seed({ confirmedAt: 2, text: "Kelas 12 IPA." });
    await f.seed({ confirmedAt: 3, text: "Sulit di peluang." });
    const model = writes("Siap SNBT 2027 dan sulit di peluang.");
    await f.build();
    const prompt = promptOf(model);
    expect(prompt).toContain("# Current Portrait\\n\\nSiap SNBT 2027.");
    expect(prompt).toContain("- Sulit di peluang.");
    expect(prompt).not.toContain("Mau ikut SNBT 2027.");
    expect(prompt).not.toContain("Kelas 12 IPA.");
    expect(await f.portrait()).toBe("Siap SNBT 2027 dan sulit di peluang.");
    expect(await f.rows()).toEqual([expect.objectContaining({ through: 3 })]);
  });

  it("stores what the model writes when a newer memory contradicts a sentence, and sends it the old portrait and the newer memory to judge", async () => {
    const f = await createRequestedTest({
      text: "Duduk di kelas 11.",
      through: 2,
    });
    await f.seed({ confirmedAt: 3, text: "Sekarang aku kelas 12." });
    const model = writes("Duduk di kelas 12.");
    await f.build();
    const prompt = promptOf(model);
    expect(prompt).toContain("Duduk di kelas 11.");
    expect(prompt).toContain("- Sekarang aku kelas 12.");
    expect(await f.portrait()).toBe("Duduk di kelas 12.");
  });

  it("cuts each memory to 400 characters and reads no more than forty", async () => {
    const f = await createRequestedTest();
    const long = `Long ${"word ".repeat(120)}`.trim();
    await f.fill(45, { text: long });
    const model = writes("Panjang.");
    await f.build();
    const prompt = promptOf(model);
    expect(prompt.split("\\n- ")).toHaveLength(41);
    expect(prompt).toContain(`${long.slice(0, 400)}...`);
    expect(prompt).not.toContain(long.slice(0, 401));
  });

  it("reads the memories forty at a time, the oldest first, and asks for the next build without the wait of a day until none is left", async () => {
    const f = await createRequestedTest();
    await f.fill(45);
    const first = writes("Panjang.");
    await f.build();
    // The prompt's own part, then the oldest forty.
    const one = promptOf(first).split("\\n- ");
    expect(one).toHaveLength(41);
    expect(one[1]).toContain("Memory 0");
    expect(one[40]).toContain("Memory 39");
    expect(await f.rows()).toEqual([
      expect.objectContaining({ builtAt: NOW + 31_000, through: 40 }),
    ]);
    // The page that was stored asked for the next build, though a build went
    // to the model a moment ago.
    expect(await f.scheduled()).toEqual([{ userId: f.identity.userId }]);
    f.quiet();
    const second = writes("Panjang dan baru.");
    await f.build();
    const two = promptOf(second).split("\\n- ");
    expect(two).toHaveLength(6);
    expect(two[1]).toContain("Memory 40");
    expect(two[5]).toContain("Memory 44");
    expect(promptOf(second)).toContain("# Current Portrait\\n\\nPanjang.");
    expect(await f.portrait()).toBe("Panjang dan baru.");
    expect(await f.rows()).toEqual([expect.objectContaining({ through: 45 })]);
    // The last page asks for no more.
    expect(await f.scheduled()).toHaveLength(1);
  });

  it("asks no model when no memory is newer than the portrait, and writes nothing", async () => {
    const f = await createRequestedTest({
      text: "Siap SNBT 2027.",
      through: 3,
    });
    await f.seed({ confirmedAt: 3, text: "Already read" });
    const model = writes("Never written.");
    await f.build();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.portrait()).toBe("Siap SNBT 2027.");
    expect(await f.rows()).toEqual([expect.objectContaining({ through: 3 })]);
  });

  it("hands no situation to the model, and moves past it so the next build does not read it again", async () => {
    const f = await createRequestedTest({
      text: "Siap SNBT 2027.",
      through: 3,
    });
    await f.seed({
      confirmedAt: 5,
      kind: "situation",
      text: "Ujian kimia 20 Oktober.",
      validUntil: NOW + 86_400_000,
    });
    const model = writes("Never written.");
    await f.build();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.portrait()).toBe("Siap SNBT 2027.");
    expect(await f.rows()).toEqual([expect.objectContaining({ through: 5 })]);
  });

  it("takes the text out when the model finds nothing worth keeping, and keeps the row so the memories are not read again", async () => {
    const f = await createRequestedTest({
      text: "Siap SNBT 2027.",
      through: 2,
    });
    await f.seed({ confirmedAt: 3, text: "Besok ulangan." });
    writes("");
    await f.build();
    expect(await f.portrait()).toBeNull();
    expect(await f.rows()).toEqual([expect.objectContaining({ through: 3 })]);
  });

  it("builds nothing before the request has had its quiet", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({ scheduledAt: NOW });
    await f.seed({ text: "Mau ikut SNBT 2027." });
    const model = writes("Never written.");
    await f.build();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.portrait()).toBeNull();
  });

  it("builds nothing for a learner with no request", async () => {
    const f = await createPortraitTest();
    await f.seed({ text: "Mau ikut SNBT 2027." });
    const model = writes("Never written.");
    await f.build();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.rows()).toEqual([]);
  });

  it("builds nothing while memory is paused", async () => {
    const f = await createRequestedTest();
    await f.seed({ text: "Mau ikut SNBT 2027." });
    await f.owner.mutation(pause, { paused: true });
    const model = writes("Never written.");
    await f.build();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.portrait()).toBeNull();
  });

  it("builds nothing for an account that is going", async () => {
    const f = await createRequestedTest();
    await f.seed({ text: "Mau ikut SNBT 2027." });
    await f.t.mutation((ctx) =>
      ctx.db.patch(f.identity.userId, { deletionPreparedAt: NOW })
    );
    const model = writes("Never written.");
    await f.build();
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("removes the row of a learner who has no memory left, without asking a model", async () => {
    const f = await createRequestedTest();
    const model = writes("Never written.");
    await f.build();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await f.rows()).toEqual([]);
  });
});

describe("a portrait build that the learner changes things under", () => {
  it("rebuilds from scratch after the learner deletes a memory on the page: the old text goes at once and the new portrait lacks the memory", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({
      scheduledAt: NOW - 86_400_000,
      text: "Duduk di kelas 12 dan suka contoh soal.",
      through: 3,
    });
    await f.seed({ confirmedAt: 1, text: "Duduk di kelas 12." });
    const gone = await f.seed({ confirmedAt: 2, text: "Suka contoh soal." });
    await f.seed({ confirmedAt: 3, text: "Mau ikut SNBT 2027." });
    await f.owner.mutation(remove, { id: gone });
    expect(await f.portrait()).toBeNull();
    expect(await f.scheduled()).toHaveLength(1);
    const model = writes("Duduk di kelas 12 dan mau ikut SNBT 2027.");
    f.quiet();
    await f.build();
    const prompt = promptOf(model);
    expect(prompt).toContain("# Current Portrait\\n\\nNone yet.");
    expect(prompt).toContain("- Duduk di kelas 12.");
    expect(prompt).toContain("- Mau ikut SNBT 2027.");
    expect(prompt).not.toContain("Suka contoh soal");
    expect(await f.portrait()).toBe(
      "Duduk di kelas 12 dan mau ikut SNBT 2027."
    );
  });

  it("rebuilds from scratch after the learner rewrites a memory on the page", async () => {
    const f = await createPortraitTest();
    await f.seedPortrait({
      scheduledAt: NOW - 86_400_000,
      text: "Duduk di kelas 11.",
      through: 1,
    });
    const id = await f.seed({ confirmedAt: 1, text: "Duduk di kelas 11." });
    await f.owner.mutation(edit, { id, text: "Duduk di kelas 12." });
    expect(await f.portrait()).toBeNull();
    const model = writes("Duduk di kelas 12.");
    f.quiet();
    await f.build();
    expect(promptOf(model)).toContain("# Current Portrait\\n\\nNone yet.");
    expect(promptOf(model)).toContain("- Duduk di kelas 12.");
    expect(await f.portrait()).toBe("Duduk di kelas 12.");
  });

  it("makes one model call for a burst of saves of a memory the learner is writing", async () => {
    const f = await createPortraitTest();
    const id = await f.seed({ author: "learner", text: "Kelas" });
    const model = writes("Kelas 12 IPA.");
    let seconds = 0;
    for (const text of ["Kelas 1", "Kelas 12", "Kelas 12 I", "Kelas 12 IPA"]) {
      seconds += 3;
      vi.setSystemTime(NOW + seconds * 1000);
      await f.owner.mutation(edit, { id, text });
    }
    expect(await f.scheduled()).toHaveLength(4);
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(promptOf(model)).toContain("- Kelas 12 IPA");
    expect(await f.portrait()).toBe("Kelas 12 IPA.");
  });

  it("writes nothing when the learner deletes a memory the model was reading, and the rebuild the deletion asked for has the last word", async () => {
    const f = await createRequestedTest({
      text: "Siap SNBT 2027.",
      through: 1,
    });
    await f.seed({ confirmedAt: 1, text: "Siap SNBT 2027." });
    const gone = await f.seed({
      confirmedAt: 2,
      text: "Takut pada logaritma.",
    });
    writesAfter(
      () => f.owner.mutation(remove, { id: gone }),
      "Siap SNBT 2027 dan takut pada logaritma."
    );
    await f.build();
    // The deletion took the old text out and no build stored the sentence it said.
    expect(await f.portrait()).toBeNull();
    const later = writes("Siap SNBT 2027.");
    f.quiet();
    await f.build();
    expect(promptOf(later)).not.toContain("logaritma");
    expect(await f.portrait()).toBe("Siap SNBT 2027.");
  });

  it("writes nothing when the learner deletes every memory while the model reads", async () => {
    const f = await createRequestedTest();
    await f.seed({ text: "Mau ikut SNBT 2027." });
    writesAfter(() => f.owner.mutation(clear, {}), "Mau ikut SNBT 2027.");
    await f.build();
    expect(await f.rows()).toEqual([]);
  });

  it("writes nothing when a second build stored first", async () => {
    const f = await createRequestedTest();
    await f.seed({ confirmedAt: 4, text: "Mau ikut SNBT 2027." });
    writesAfter(async () => {
      await f.t.mutation(async (ctx) => {
        const row = await ctx.db.query("ninaMemoryPortraits").first();
        if (row) {
          await ctx.db.patch(row._id, { through: 4 });
        }
      });
    }, "Never stored.");
    await f.build();
    expect(await f.portrait()).toBeNull();
  });
});

describe("a portrait build that fails", () => {
  it("logs the provider's routing facts, never its words, and leaves the portrait as it was", async () => {
    const f = await createRequestedTest({
      text: "Siap SNBT 2027.",
      through: 1,
    });
    await f.seed({ confirmedAt: 2, text: "Sulit di peluang." });
    fails(() =>
      Promise.reject(
        new APICallError({
          message: "Private provider detail",
          requestBodyValues: { prompt: "Sulit di peluang." },
          statusCode: 400,
          isRetryable: false,
          url: "https://ai-gateway.convex.dev/v1/chat/completions",
        })
      )
    );
    await f.build();
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({
        operation: "generate",
        reason: "invalid",
        rejected: false,
        status: 400,
      })
    );
    expect(encodeJsonText(MutableRef.get(f.logged))).not.toContain("Private");
    expect(encodeJsonText(MutableRef.get(f.logged))).not.toContain("peluang");
    expect(await f.portrait()).toBe("Siap SNBT 2027.");
    expect(await f.rows()).toEqual([expect.objectContaining({ through: 1 })]);
  });

  it("rejects a portrait of more than 1200 characters, and keeps 1200", async () => {
    const f = await createRequestedTest({
      text: "Siap SNBT 2027.",
      through: 1,
    });
    await f.seed({ confirmedAt: 2, text: "Sulit di peluang." });
    writes("x".repeat(1201));
    await f.build();
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "generate", rejected: true })
    );
    expect(await f.portrait()).toBe("Siap SNBT 2027.");
    writes("x".repeat(1200));
    f.quiet();
    await f.build();
    expect(await f.portrait()).toBe("x".repeat(1200));
  });

  it("logs a build that dies and saves nothing", async () => {
    const f = await createRequestedTest();
    await f.seed({ text: "Mau ikut SNBT 2027." });
    writes("Never stored.");
    vi.stubEnv("VAULT_ROOT_KEYS", "");
    await f.build();
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "unknown", rejected: false })
    );
    expect(await f.rows()).toEqual([expect.objectContaining({ through: 0 })]);
  });
});
