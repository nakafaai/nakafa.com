import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { sealedSummary } from "@repo/backend/test/seal";
import { Array as Arr } from "effect";

const brief = Ref.getFunctionReference(refs.internal.nina.brief.read);
const NOW = Date.UTC(2026, 9, 10, 12);

/** The brief of the queued turn of a fixture whose chat holds three turns before it. */
async function briefOf(f: Awaited<ReturnType<typeof fixture>>) {
  return Ref.decodeReturnsSync(
    refs.internal.nina.brief.read,
    await f.t.query(brief, {
      chatId: f.chatId,
      now: NOW,
      order: 3,
      promptMessageId: f.promptMessageId,
      topics: [],
      userId: f.identity.userId,
    })
  );
}

function fixture() {
  return createMemoryTest({
    history: 3,
    now: NOW,
    prompt: "Kapan jadwal SNBT?",
  });
}

describe("the brief of a Nina turn", () => {
  it("lists the complete turns before the turn when the chat has no summary, newest first", async () => {
    const f = await fixture();
    const read = await briefOf(f);
    expect(read.summary).toBeNull();
    expect(Arr.map(read.uncovered, ({ order }) => order)).toEqual([2, 1, 0]);
  });

  it("gives the summary opened, and only the turns after the order it covers", async () => {
    const f = await fixture();
    await f.t.mutation(async (ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId: f.chatId,
        text: await sealedSummary(ctx, f.identity.userId, "Limits so far."),
        throughOrder: 1,
        updatedAt: NOW,
        usage: { calls: 1, input: 10, output: 5 },
      })
    );
    const read = await briefOf(f);
    expect(read.summary).toEqual({ text: "Limits so far.", throughOrder: 1 });
    expect(Arr.map(read.uncovered, ({ order }) => order)).toEqual([2]);
  });

  it("tells what the turn knows of the learner from the words of its own message", async () => {
    const f = await fixture();
    await f.seed({ text: "Mau ikut SNBT 2027." });
    await f.seed({ text: "Suka contoh soal dulu." });
    const read = await briefOf(f);
    // The words of the message ("SNBT") call up the memory that holds them.
    expect(read.learner.recalled[0]).toMatchObject({
      text: "Mau ikut SNBT 2027.",
    });
    expect(read.learner.paused).toBe(false);
  });

  it("tells a learner who paused memory that no memory is read, and no summary of a chat that is gone", async () => {
    const f = await fixture();
    await f.seed({ text: "Mau ikut SNBT 2027." });
    await f.t.mutation(async (ctx) => {
      await ctx.db.insert("learningPreferences", {
        ninaMemoryPaused: true,
        updatedAt: NOW,
        userId: f.identity.userId,
      });
    });
    const read = await briefOf(f);
    expect(read.learner).toMatchObject({ paused: true, recalled: [] });
    await f.t.mutation((ctx) => ctx.db.delete("chats", f.chatId));
    expect((await briefOf(f)).summary).toBeNull();
  });
});
