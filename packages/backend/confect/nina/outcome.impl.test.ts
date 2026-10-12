import { toUIMessages } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { CapabilityOutputSchema } from "@repo/backend/client/nina/capability";
import { components } from "@repo/backend/confect/_generated/components";
import type { CapabilityArtifact } from "@repo/backend/confect/nina/capability/progress";
import type { OutcomeCursor } from "@repo/backend/confect/nina/outcome.spec";
import {
  chatOf,
  counts,
  done,
  fixture,
  heaviestChat,
  json,
  longChat,
  oldOutput,
  outputs,
  pass,
  resultOf,
  rewrite,
  stored,
  total,
  turn,
} from "@repo/backend/test/nina/outcome";
import { isToolUIPart } from "ai";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";

const loaded = {
  type: "data-scrape-url",
  id: "scrape-1",
  data: {
    content: "The page.",
    status: "done",
    url: "https://example.com/limits",
  },
} satisfies CapabilityArtifact;
const lost = {
  type: "data-scrape-url",
  id: "scrape-2",
  data: {
    content: "",
    error: "Unreadable",
    status: "error",
    url: "https://example.com/missing",
  },
} satisfies CapabilityArtifact;

/** What the function stores for an old output of a run that failed with nothing loaded. */
const failed = {
  artifacts: [],
  outcome: "failed",
  text: "Evidence of a failed run.",
};

/**
 * Runs a whole pass over the chats and returns how large a share of its
 * tightest transaction limit the heaviest call used, with what it rewrote.
 */
async function heaviestShare(messages: Parameters<typeof fixture>[0]) {
  const f = await fixture(messages);
  let share = 0;
  let rewritten = 0;
  let cursor: typeof OutcomeCursor.Type | null = null;
  do {
    const call = await f.t.mutation(async (ctx) => {
      const report = await ctx.runMutation(rewrite, { cursor });
      return { metrics: await ctx.meta.getTransactionMetrics(), report };
    });
    share = Math.max(
      share,
      ...Arr.map(
        Rec.values(call.metrics),
        ({ remaining, used }) => used / (used + remaining)
      )
    );
    rewritten += call.report.rewritten;
    cursor = call.report.cursor;
  } while (cursor !== null);
  return { rewritten, share };
}

describe("nina/outcome", () => {
  it.each([
    ["failed with nothing loaded", "deepResearch", "failed", [], "failed"],
    [
      "failed beside a loaded card",
      "deepResearch",
      "failed",
      [loaded],
      "partial",
    ],
    ["failed beside a lost card", "nakafa", "failed", [lost], "failed"],
    [
      "failed beside a lost card and a loaded one",
      "math",
      "failed",
      [lost, loaded],
      "partial",
    ],
    ["denied", "math", "denied", [], "denied"],
    ["denied beside a loaded card", "nakafa", "denied", [loaded], "denied"],
    ["over the source limit", "deepResearch", "sourceLimit", [], "limit"],
    [
      "over the source limit beside a loaded card",
      "deepResearch",
      "sourceLimit",
      [loaded],
      "limit",
    ],
  ] as const)(
    "rewrites an output that is %s to the outcome the runner stores today",
    async (_name, toolName, failure, artifacts, outcome) => {
      const f = await fixture(
        turn(toolName, json(oldOutput(failure, artifacts)))
      );
      const [threadId = ""] = f.threadIds;
      expect(await pass(f.t, null)).toEqual([
        { cursor: null, rewritten: 1, scanned: 4 },
      ]);
      const [output] = await outputs(f.t, threadId);
      expect(output).toStrictEqual({
        artifacts,
        outcome,
        text: `Evidence of a ${failure} run.`,
      });
      expect(Schema.is(CapabilityOutputSchema)(output)).toBe(true);
    }
  );

  it("makes the chat read the outcome of an old output", async () => {
    const f = await fixture(
      turn("deepResearch", json(oldOutput("failed", [loaded])))
    );
    const [threadId = ""] = f.threadIds;
    const outcomes = async () =>
      Arr.flatMap(toUIMessages(await stored(f.t, threadId)), ({ parts }) =>
        Arr.flatMap(parts, (part) =>
          isToolUIPart(part) &&
          part.state === "output-available" &&
          Schema.is(CapabilityOutputSchema)(part.output)
            ? [part.output.outcome ?? "done"]
            : []
        )
      );
    // The chat reads the output of the Agent as it is, so the old one reads as done.
    expect(await outcomes()).toEqual(["done"]);
    await pass(f.t, null);
    expect(await outcomes()).toEqual(["partial"]);
  });

  it("weighs only the cards that read as cards", async () => {
    // A card that says it is done, but lacks the content and the address of one.
    const unreadable = {
      id: "scrape-3",
      type: "data-scrape-url",
      data: { status: "done" },
    };
    const f = await fixture([
      ...turn(
        "deepResearch",
        json(oldOutput("failed", [unreadable])),
        "call-1"
      ),
      ...turn(
        "deepResearch",
        json(oldOutput("failed", [unreadable, loaded])),
        "call-2"
      ),
    ]);
    const [threadId = ""] = f.threadIds;
    await pass(f.t, null);
    expect(
      Arr.map(await outputs(f.t, threadId), (output) => output.outcome)
    ).toEqual(["failed", "partial"]);
  });

  it("changes only the old output, and keeps every other part, key and field", async () => {
    const f = await fixture([
      { role: "user", content: "Question" },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "deepResearch",
            output: {
              ...json({ ...oldOutput("failed", [loaded]), note: "kept" }),
              providerOptions: { nakafa: { cached: true } },
            },
            providerOptions: { nakafa: { step: 1 } },
          },
          {
            type: "tool-result",
            toolCallId: "call-2",
            toolName: "nakafa",
            output: json({ ...done, outcome: "partial" }),
          },
        ],
        providerOptions: { nakafa: { turn: 1 } },
      },
    ]);
    const [threadId = ""] = f.threadIds;
    const before = await stored(f.t, threadId);
    expect(await pass(f.t, null)).toEqual([
      { cursor: null, rewritten: 1, scanned: 2 },
    ]);
    const rewritten = {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "deepResearch",
          output: {
            type: "json",
            value: {
              artifacts: [loaded],
              note: "kept",
              outcome: "partial",
              text: "Evidence of a failed run.",
            },
            providerOptions: { nakafa: { cached: true } },
          },
          providerOptions: { nakafa: { step: 1 } },
        },
        {
          type: "tool-result",
          toolCallId: "call-2",
          toolName: "nakafa",
          output: json({ ...done, outcome: "partial" }),
        },
      ],
      providerOptions: { nakafa: { turn: 1 } },
    };
    expect(await stored(f.t, threadId)).toStrictEqual(
      Arr.map(before, (doc) =>
        doc.message?.role === "tool" ? { ...doc, message: rewritten } : doc
      )
    );
  });

  it("leaves current outputs, other tools, other kinds of output and every other message as they are", async () => {
    const f = await fixture([
      { role: "user", content: "Question" },
      { role: "assistant", content: "Answer" },
      resultOf("nakafa", json({ ...done, outcome: "partial" }), "call-1"),
      resultOf("deepResearch", json(done), "call-2"),
      resultOf("quran", json(oldOutput("failed")), "call-3"),
      resultOf("math", { type: "text", value: "A plain result." }, "call-4"),
      resultOf(
        "math",
        { type: "error-text", value: "The tool failed." },
        "call-5"
      ),
      resultOf("nakafa", json(oldOutput("elsewhere")), "call-6"),
      {
        role: "tool",
        content: [
          {
            type: "tool-approval-response",
            approvalId: "ask-1",
            approved: true,
          },
        ],
      },
    ]);
    const [threadId = ""] = f.threadIds;
    const before = await stored(f.t, threadId);
    expect(await pass(f.t, null)).toEqual([
      { cursor: null, rewritten: 0, scanned: 9 },
    ]);
    expect(await stored(f.t, threadId)).toStrictEqual(before);
  });

  it("rewrites the messages of a turn that failed or was stopped", async () => {
    const f = await fixture(turn("deepResearch", json(oldOutput("failed"))));
    const [threadId = ""] = f.threadIds;
    const result = Option.getOrThrow(
      Arr.findFirst(
        await stored(f.t, threadId),
        ({ message }) => message?.role === "tool"
      )
    );
    await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.messages.updateMessage, {
        messageId: result._id,
        patch: { error: "cancelled", status: "failed" },
      })
    );
    expect(await pass(f.t, null)).toEqual([
      { cursor: null, rewritten: 1, scanned: 4 },
    ]);
    expect(await outputs(f.t, threadId)).toStrictEqual([failed]);
  });

  it("rewrites five messages at most in a call and picks up where it stopped", async () => {
    const f = await fixture(chatOf(25, Arr.range(0, 24)));
    const [threadId = ""] = f.threadIds;
    expect(counts(await pass(f.t, null))).toEqual([
      ...Arr.makeBy(5, () => ({ rewritten: 5, scanned: 20 })),
      { rewritten: 0, scanned: 0 },
    ]);
    expect(await outputs(f.t, threadId)).toStrictEqual(
      Arr.makeBy(25, () => failed)
    );
  });

  it("opens five chats at most in a call and continues with the next chat", async () => {
    const marked = [2, 11, 23];
    const f = await fixture(
      ...Arr.makeBy(25, (index) =>
        turn(
          "deepResearch",
          json(Arr.contains(marked, index) ? oldOutput("failed") : done)
        )
      )
    );
    const reports = await pass(f.t, null);
    expect(counts(reports)).toEqual([
      { rewritten: 1, scanned: 20 },
      { rewritten: 0, scanned: 20 },
      { rewritten: 1, scanned: 20 },
      { rewritten: 0, scanned: 20 },
      { rewritten: 1, scanned: 20 },
      { rewritten: 0, scanned: 0 },
    ]);
    // A call that stops between chats leaves no thread to resume.
    expect(Arr.map(reports, ({ cursor }) => cursor?.messages ?? null)).toEqual(
      Arr.makeBy(6, () => null)
    );
    expect(
      await Promise.all(Arr.map(f.threadIds, (id) => outputs(f.t, id)))
    ).toStrictEqual(
      Arr.makeBy(25, (index) => [Arr.contains(marked, index) ? failed : done])
    );
  });

  it("carries a second cursor into the next call when one chat has more messages than a call reads", async () => {
    const marked = [1, 9, 10, 99, 100, 129];
    const f = await fixture(longChat(marked));
    const [threadId = ""] = f.threadIds;
    const reports = await pass(f.t, null);
    expect(counts(reports)).toEqual([
      { rewritten: 4, scanned: 100 },
      { rewritten: 2, scanned: 30 },
    ]);
    const [first] = reports;
    expect(first?.cursor?.messages?.threadId).toBe(threadId);
    expect(await outputs(f.t, threadId)).toStrictEqual(
      Arr.makeBy(marked.length, () => failed)
    );
  });

  it("reads a finished pass again without changing anything", async () => {
    const f = await fixture(chatOf(30, [3, 12, 29]), chatOf(2, [1]));
    const read = () =>
      Promise.all(Arr.map(f.threadIds, (id) => stored(f.t, id)));
    expect(total(await pass(f.t, null), "rewritten")).toBe(4);
    const before = await read();
    const again = await pass(f.t, null);
    expect(total(again, "rewritten")).toBe(0);
    expect(total(again, "scanned")).toBe(128);
    expect(await read()).toStrictEqual(before);
  });

  it("goes on past a chat that was deleted between two calls", async () => {
    const f = await fixture(
      longChat([129]),
      turn("deepResearch", json(oldOutput("failed")))
    );
    const chatId = Option.getOrThrow(Arr.get(f.chatIds, 0));
    const threadId = Option.getOrThrow(Arr.get(f.threadIds, 0));
    const next = Option.getOrThrow(Arr.get(f.threadIds, 1));
    const midway = await f.t.mutation(rewrite, { cursor: null });
    expect(midway.cursor?.messages?.threadId).toBe(threadId);
    await f.t.mutation(async (ctx) => {
      await ctx.db.delete("chats", chatId);
      await ctx.runMutation(components.nina.threads.deleteAllForThreadIdAsync, {
        limit: 1000,
        threadId,
      });
    });
    expect(await pass(f.t, midway.cursor)).toEqual([
      { cursor: null, rewritten: 1, scanned: 4 },
    ]);
    expect(await outputs(f.t, next)).toStrictEqual([failed]);
  });

  it("stays far below every transaction limit on the heaviest outputs", async () => {
    const old = await heaviestShare(heaviestChat(true));
    const clean = await heaviestShare(heaviestChat(false));
    expect([old.rewritten, clean.rewritten]).toEqual([25, 0]);
    expect(Math.max(old.share, clean.share)).toBeLessThan(0.25);
  });
});
