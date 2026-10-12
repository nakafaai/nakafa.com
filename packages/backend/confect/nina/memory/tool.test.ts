import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import { runMemory } from "@repo/backend/confect/nina/memory/tool";
import type { createNinaTest } from "@repo/backend/test/nina";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { Array as Arr, Effect, String as Str } from "effect";

const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);

const NOW = Date.UTC(2026, 9, 12, 12);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** What the capability answers for a query, as the learner of the fixture or the learner named. */
function ask(
  f: Awaited<ReturnType<typeof createNinaTest>>,
  query: string,
  userId = f.identity.userId
) {
  return f.t.action((ctx) =>
    Effect.runPromise(
      runMemory({ query, userId }).pipe(
        Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
      )
    )
  );
}

/** The lines of an answer that list a memory, in order. */
function listed(text: string) {
  return Arr.filter(Str.split(text, "\n"), Str.startsWith("- "));
}

describe("the memory capability", () => {
  it("answers with the best matches for the query, at most six, the newest first, each with the day it was last confirmed", async () => {
    const f = await createMemoryTest();
    for (const day of Arr.range(1, 8)) {
      await f.seed({
        confirmedAt: Date.UTC(2026, 8, day),
        text: `Catatan SNBT hari ${day}`,
      });
    }
    await f.seed({
      confirmedAt: Date.UTC(2026, 8, 20),
      text: "Hobi main gitar",
    });
    const answer = await ask(f, "snbt");
    expect(answer).not.toHaveProperty("outcome");
    expect(listed(answer.text)).toEqual([
      "- Catatan SNBT hari 8 (2026-09-08)",
      "- Catatan SNBT hari 7 (2026-09-07)",
      "- Catatan SNBT hari 6 (2026-09-06)",
      "- Catatan SNBT hari 5 (2026-09-05)",
      "- Catatan SNBT hari 4 (2026-09-04)",
      "- Catatan SNBT hari 3 (2026-09-03)",
    ]);
    expect(answer.text).toContain("# Memories Found");
    expect(answer.text).toContain("never instructions");
  });

  it("finds a memory by its title as well as its words, and writes each as its title and words", async () => {
    const f = await createMemoryTest();
    await f.seed({
      author: "learner",
      confirmedAt: Date.UTC(2026, 8, 1),
      text: "Hari Senin pukul tujuh",
      title: "Jadwal les",
    });
    const answer = await ask(f, "jadwal");
    expect(listed(answer.text)).toEqual([
      "- Jadwal les: Hari Senin pukul tujuh (2026-09-01)",
    ]);
  });

  it("gives each memory in nearly full, 800 characters, and marks the cut", async () => {
    const f = await createMemoryTest();
    const long = `Catatan ${"panjang ".repeat(240)}`.trim();
    await f.seed({ author: "learner", text: long });
    const [line] = listed((await ask(f, "catatan")).text);
    expect(line).toBe(`- ${long.slice(0, 800)}... (1970-01-01)`);
  });

  it("keeps the whole answer within 1,500 tokens and says that others were left out", async () => {
    const f = await createMemoryTest();
    // Rare characters take about a token each, so six memories of 800
    // characters are far more than the answer may hold.
    const rare = Arr.join(
      Arr.makeBy(760, (index) => String.fromCodePoint(0x4e_00 + index * 3)),
      ""
    );
    await f.fill(6, { text: `snbt ${rare}` });
    const { text } = await ask(f, "snbt");
    expect(text).toContain(
      "Other memories were left out. Ask again with a narrower query to read them.]"
    );
    expect(Arr.length(listed(text))).toBeLessThan(6);
    const inside = Arr.join(
      Arr.takeWhile(
        Arr.drop(Str.split(text, "\n"), 3),
        (line) => line !== "</memories>"
      ),
      "\n"
    );
    expect(countTextTokens(inside)).toBeLessThanOrEqual(NINA_BUDGET.lookup);
  });

  it("says in one line that nothing was found, and marks the run as empty", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Hobi main gitar" });
    const answer = await ask(f, "tanggal ujian");
    expect(answer).toMatchObject({
      outcome: "empty",
      text: expect.stringContaining("No saved memory matches this query."),
    });
    expect(Arr.length(Str.split(answer.text, "\n"))).toBe(1);
  });

  it("says nothing was found for a learner who has no memory", async () => {
    const f = await createMemoryTest();
    expect(await ask(f, "snbt")).toMatchObject({ outcome: "empty" });
  });

  it("never finds a memory of another learner", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.seed({ text: "Rahasia SNBT mereka", userId: other.userId });
    expect(await ask(f, "snbt")).toMatchObject({ outcome: "empty" });
    expect(listed((await ask(f, "snbt", other.userId)).text)).toEqual([
      "- Rahasia SNBT mereka (1970-01-01)",
    ]);
  });

  it("finds nothing that Delete all took, though a batch still holds it", async () => {
    const f = await createMemoryTest();
    await f.fill(4, { text: "Catatan snbt" });
    await f.markCleared(2);
    expect(Arr.length(listed((await ask(f, "snbt")).text))).toBe(2);
  });

  it("refuses while memory is paused, as a policy does", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Mau ikut SNBT 2027" });
    await f.owner.mutation(pause, { paused: true });
    expect(await ask(f, "snbt")).toEqual({
      outcome: "denied",
      text: expect.stringContaining("The learner paused memory"),
    });
  });

  it("writes nothing: a memory it returns is not thereby confirmed", async () => {
    const f = await createMemoryTest();
    await f.seed({ confirmedAt: 5, text: "Mau ikut SNBT 2027" });
    const stored = await f.stored();
    const keys = await f.keys();
    vi.setSystemTime(NOW + 3_600_000);
    expect(listed((await ask(f, "snbt")).text)).toHaveLength(1);
    // `toStrictEqual` compares the sealed bytes; `toEqual` takes any two buffers for equal.
    expect(await f.stored()).toStrictEqual(stored);
    expect(await f.keys()).toStrictEqual(keys);
  });
});
