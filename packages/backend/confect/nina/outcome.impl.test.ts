import { toUIMessages } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { CapabilityOutputSchema } from "@repo/backend/client/nina/capability";
import { components } from "@repo/backend/confect/_generated/components";
import type { CapabilityArtifact } from "@repo/backend/confect/nina/capability/progress";
import {
  agentChat,
  bulkyOutput,
  chatOf,
  counts,
  done,
  fixture,
  idle,
  json,
  longChat,
  measuredPass,
  oldOutput,
  outputs,
  partOf,
  pass,
  resultOf,
  rewrite,
  stepsOf,
  stored,
  total,
  turn,
  unmarkedOutput,
} from "@repo/backend/test/nina/outcome";
import { isToolUIPart } from "ai";
import { Array as Arr, Option, Schema } from "effect";

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

  it.each([
    ["with a lost card and nothing loaded", "nakafa", [lost], "failed"],
    [
      "with a lost card beside a loaded one",
      "deepResearch",
      [loaded, lost],
      "partial",
    ],
  ] as const)(
    "rewrites an output without the old key %s to the outcome the runner stores today",
    async (_name, toolName, artifacts, outcome) => {
      const f = await fixture(turn(toolName, json(unmarkedOutput(artifacts))));
      const [threadId = ""] = f.threadIds;
      expect(await pass(f.t, null)).toEqual([
        { cursor: null, rewritten: 1, scanned: 4 },
      ]);
      const [output] = await outputs(f.t, threadId);
      expect(output).toStrictEqual({
        artifacts,
        outcome,
        text: "Evidence of an unmarked run.",
      });
      expect(Schema.is(CapabilityOutputSchema)(output)).toBe(true);
    }
  );

  it("makes the chat read the outcome of an old output that the Agent stored itself", async () => {
    const f = await agentChat(oldOutput("failed", [loaded]));
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

  it("rewrites every old output of one message and leaves the other parts of it", async () => {
    const f = await fixture([
      { role: "user", content: "Question" },
      {
        role: "tool",
        content: [
          partOf("deepResearch", json(oldOutput("failed", [loaded])), "call-1"),
          partOf("nakafa", json(unmarkedOutput([lost])), "call-2"),
          partOf("math", json({ ...done, outcome: "partial" }), "call-3"),
        ],
      },
    ]);
    const [threadId = ""] = f.threadIds;
    expect(await pass(f.t, null)).toEqual([
      { cursor: null, rewritten: 1, scanned: 2 },
    ]);
    expect(await outputs(f.t, threadId)).toStrictEqual([
      {
        artifacts: [loaded],
        outcome: "partial",
        text: "Evidence of a failed run.",
      },
      {
        artifacts: [lost],
        outcome: "failed",
        text: "Evidence of an unmarked run.",
      },
      { ...done, outcome: "partial" },
    ]);
  });

  it("leaves outputs that need no outcome, other tools, other kinds of output and every other message as they are", async () => {
    // A lost card that does not read as a card, so there is no loss to weigh.
    const unreadable = {
      id: "scrape-4",
      type: "data-scrape-url",
      data: { status: "error" },
    };
    const f = await fixture([
      { role: "user", content: "Question" },
      { role: "assistant", content: "Answer" },
      resultOf("nakafa", json({ ...done, outcome: "partial" }), "call-1"),
      resultOf("deepResearch", json(done), "call-2"),
      resultOf(
        "deepResearch",
        json({ artifacts: [loaded], text: "Complete." }),
        "call-3"
      ),
      resultOf(
        "deepResearch",
        json({ ...unmarkedOutput([loaded, lost]), outcome: "partial" }),
        "call-4"
      ),
      resultOf("nakafa", json(unmarkedOutput([unreadable])), "call-5"),
      resultOf("quran", json(oldOutput("failed")), "call-6"),
      resultOf("quran", json(unmarkedOutput([lost])), "call-7"),
      resultOf("math", { type: "text", value: "A plain result." }, "call-8"),
      resultOf(
        "math",
        { type: "error-text", value: "The tool failed." },
        "call-9"
      ),
      resultOf("nakafa", json(oldOutput("elsewhere")), "call-10"),
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
      { cursor: null, rewritten: 0, scanned: 13 },
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

  it.each([
    ["the first page of a chat", []],
    ["a later page of a chat", idle(20)],
  ] as const)(
    "rewrites three messages at most in a call, even when %s holds more, and reads that page again",
    async (_name, before) => {
      const f = await fixture([
        ...before,
        ...stepsOf(7, () => oldOutput("failed")),
      ]);
      const [threadId = ""] = f.threadIds;
      const reports = await pass(f.t, null);
      expect(counts(reports)).toEqual([
        { rewritten: 3, scanned: before.length + 16 },
        { rewritten: 3, scanned: 16 },
        { rewritten: 1, scanned: 16 },
      ]);
      // A call that leaves some of a page for the next one ends where it began.
      expect(reports[1]?.cursor).toEqual(reports[0]?.cursor);
      expect(reports[2]?.cursor).toBeNull();
      expect(await outputs(f.t, threadId)).toStrictEqual(
        Arr.makeBy(7, () => failed)
      );
    }
  );

  it("opens four chats at most in a call and continues with the next chat", async () => {
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
      { rewritten: 1, scanned: 16 },
      { rewritten: 0, scanned: 16 },
      { rewritten: 1, scanned: 16 },
      { rewritten: 0, scanned: 16 },
      { rewritten: 0, scanned: 16 },
      { rewritten: 1, scanned: 16 },
      { rewritten: 0, scanned: 4 },
    ]);
    // A call that stops between chats leaves no thread to resume.
    expect(Arr.map(reports, ({ cursor }) => cursor?.messages ?? null)).toEqual(
      Arr.makeBy(7, () => null)
    );
    expect(
      await Promise.all(Arr.map(f.threadIds, (id) => outputs(f.t, id)))
    ).toStrictEqual(
      Arr.makeBy(25, (index) => [Arr.contains(marked, index) ? failed : done])
    );
  });

  it("carries a second cursor into the next call when one chat has more messages than a call reads", async () => {
    const marked = [1, 99, 100, 129];
    const f = await fixture(longChat(marked));
    const [threadId = ""] = f.threadIds;
    const reports = await pass(f.t, null);
    expect(counts(reports)).toEqual([
      { rewritten: 1, scanned: 80 },
      { rewritten: 3, scanned: 50 },
      { rewritten: 0, scanned: 0 },
    ]);
    const [first] = reports;
    expect(first?.cursor?.messages?.threadId).toBe(threadId);
    expect(await outputs(f.t, threadId)).toStrictEqual(
      Arr.makeBy(marked.length, () => failed)
    );
  });

  it("reads a finished pass again without changing anything", async () => {
    const f = await fixture(
      chatOf(30, [3, 12, 29]),
      chatOf(2, [1]),
      turn("nakafa", json(unmarkedOutput([lost])))
    );
    const read = () =>
      Promise.all(Arr.map(f.threadIds, (id) => stored(f.t, id)));
    expect(total(await pass(f.t, null), "rewritten")).toBe(5);
    const before = await read();
    const again = await pass(f.t, null);
    expect(total(again, "rewritten")).toBe(0);
    expect(total(again, "scanned")).toBe(132);
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

  it.each([
    ["a step of three large results", 330_000, 0.3],
    ["as large as a document can be", 800_000, 0.65],
  ] as const)(
    "stays below every transaction limit when each message is %s",
    async (_name, bytes, share) => {
      const f = await fixture(stepsOf(8, () => bulkyOutput(bytes)));
      const [threadId = ""] = f.threadIds;
      // Every call ran under Convex's real limits, so none went over them.
      const { peak, reports } = await measuredPass(f.t, null);
      expect(peak).toBeLessThan(share);
      expect(total(reports, "rewritten")).toBe(8);
      expect(Arr.every(reports, ({ rewritten }) => rewritten <= 3)).toBe(true);
      const results = await outputs(f.t, threadId);
      expect(Arr.map(results, (output) => output.outcome)).toEqual(
        Arr.makeBy(8, () => "partial")
      );
      expect(Arr.some(results, (output) => "failure" in output)).toBe(false);
    }
  );
});
