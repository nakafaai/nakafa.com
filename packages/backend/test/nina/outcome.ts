import { Ref } from "@confect/core";
import {
  Agent,
  createThread,
  createTool,
  saveMessages,
} from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import type {
  OutcomeCursor,
  OutcomeReport,
} from "@repo/backend/confect/nina/outcome.spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { providerStep } from "@repo/backend/test/nina/specialist";
import {
  isStepCount,
  jsonSchema,
  type ModelMessage,
  type ToolResultPart,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Record as Rec, Stream } from "effect";

const NOW = Date.UTC(2026, 9, 12, 8);

/** The temporary function that rewrites the old `failure` key of stored outputs. */
export const rewrite = Ref.getFunctionReference(
  refs.internal.nina.outcome.rewriteFailures
);

/** The output of a run that ended well, which never carried a failure. */
export const done = { artifacts: [], text: "Done." };

type JsonValue = Extract<ToolResultPart["output"], { type: "json" }>["value"];

/** A JSON tool output, the form a capability output is stored in. */
export const json = (value: JsonValue) => ({ type: "json" as const, value });

/** An output as a capability stored it before 10 October 2026 when its run failed. */
export function oldOutput(
  failure: string,
  artifacts: readonly JsonValue[] = []
) {
  return {
    artifacts: Arr.fromIterable(artifacts),
    failure,
    text: `Evidence of a ${failure} run.`,
  };
}

/** An output as a capability stored it before 10 October 2026 when its run lost a card: no key marks it. */
export function unmarkedOutput(artifacts: readonly JsonValue[]) {
  return {
    artifacts: Arr.fromIterable(artifacts),
    text: "Evidence of an unmarked run.",
  };
}

/** One tool result. */
export function partOf(
  toolName: string,
  output: ToolResultPart["output"],
  toolCallId = "call-1"
) {
  return { type: "tool-result" as const, toolCallId, toolName, output };
}

/** The tool message that holds one result. */
export function resultOf(
  toolName: string,
  output: ToolResultPart["output"],
  toolCallId = "call-1"
) {
  return {
    role: "tool" as const,
    content: [partOf(toolName, output, toolCallId)],
  };
}

/** The assistant message that calls one tool. */
function callOf(toolName: string, toolCallId: string): ModelMessage {
  return {
    role: "assistant",
    content: [{ type: "tool-call", toolCallId, toolName, input: {} }],
  };
}

/** One turn of four messages: a question, a tool call, its result, an answer. */
export function turn(
  toolName: string,
  output: ToolResultPart["output"],
  toolCallId = "call-1"
): ModelMessage[] {
  return [
    { role: "user", content: "Question" },
    callOf(toolName, toolCallId),
    resultOf(toolName, output, toolCallId),
    { role: "assistant", content: "Answer" },
  ];
}

/** One turn of `count` tool steps, a call and its result each, in which `outputOf` gives the output of a step. */
export function stepsOf(
  count: number,
  outputOf: (index: number) => JsonValue
): ModelMessage[] {
  return [
    { role: "user", content: "Question" },
    ...Arr.flatMap(
      Arr.makeBy(count, (index) => index),
      (index): ModelMessage[] => [
        callOf("deepResearch", `call-${index}`),
        resultOf("deepResearch", json(outputOf(index)), `call-${index}`),
      ]
    ),
    { role: "assistant", content: "Answer" },
  ];
}

/** `count` turns of a chat, in which the turns at `marked` hold an old output. */
export function chatOf(count: number, marked: readonly number[] = []) {
  return Arr.flatMap(
    Arr.makeBy(count, (index) => index),
    (index) =>
      turn(
        "deepResearch",
        json(Arr.contains(marked, index) ? oldOutput("failed") : done),
        `call-${index}`
      )
  );
}

/** A question or an answer, by the place of the message in a chat. */
function plainMessage(index: number): ModelMessage {
  return index % 2 === 0
    ? { role: "user", content: `Question ${index}` }
    : { role: "assistant", content: `Answer ${index}` };
}

/** `count` messages that hold no tool result. */
export function idle(count: number) {
  return Arr.makeBy(count, plainMessage);
}

/** A chat of 130 messages in which the messages at `marked` are old outputs. */
export function longChat(marked: readonly number[]) {
  return Arr.makeBy(130, (index): ModelMessage => {
    if (Arr.contains(marked, index)) {
      return resultOf(
        "deepResearch",
        json(oldOutput("failed")),
        `call-${index}`
      );
    }
    return plainMessage(index);
  });
}

/** An old output whose one card holds `bytes` characters, so that its message weighs about as much. */
export function bulkyOutput(bytes: number) {
  return oldOutput("failed", [
    {
      type: "data-scrape-url",
      id: "scrape-1",
      data: {
        content: "x".repeat(bytes),
        status: "done",
        url: "https://example.com/page",
      },
    },
  ]);
}

/** One chat for each list of messages, created in order, each with its own Agent thread. */
export async function fixture(...conversations: ModelMessage[][]) {
  const t = createConvexTestWithBetterAuth();
  const created = await t.mutation(async (ctx) => {
    const { userId } = await seedAuthenticatedUser(ctx, { now: NOW });
    let chatIds: Docs["chats"]["_id"][] = [];
    let threadIds: string[] = [];
    for (const messages of conversations) {
      const threadId = await createThread(ctx, components.nina, { userId });
      const chatId = await ctx.db.insert("chats", {
        threadId,
        type: "study",
        updatedAt: NOW,
        userId,
        visibility: "private",
      });
      await saveMessages(ctx, components.nina, { messages, threadId });
      chatIds = Arr.append(chatIds, chatId);
      threadIds = Arr.append(threadIds, threadId);
    }
    return { chatIds, threadIds };
  });
  return { ...created, t };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

/**
 * A chat whose turn the Agent itself stored. A mock model calls the capability
 * `deepResearch`, whose tool yields a progress snapshot and then `output`, as
 * the capabilities do, and the Agent saves the question, the call, the result
 * and the answer. Only the final output is stored, as in production.
 */
export async function agentChat(output: JsonValue) {
  const t = createConvexTestWithBetterAuth();
  const { userId } = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW })
  );
  const model = new MockLanguageModelV4({
    doGenerate: [
      providerStep(
        [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "deepResearch",
            input: "{}",
          },
        ],
        "tool-calls"
      ),
      providerStep([{ type: "text", text: "Answer" }]),
    ],
  });
  const agent = new Agent(components.nina, {
    languageModel: model,
    name: "test",
    stopWhen: isStepCount(3),
    tools: {
      deepResearch: createTool({
        description: "Researches a question.",
        execute: () =>
          Stream.toAsyncIterable(Stream.make({ ...done, text: "" }, output)),
        inputSchema: jsonSchema({ properties: {}, type: "object" }),
      }),
    },
  });
  const threadId = await t.action(async (ctx) => {
    const created = await agent.createThread(ctx, { userId });
    await agent.generateText(
      ctx,
      { threadId: created.threadId, userId },
      { prompt: "Question" }
    );
    return created.threadId;
  });
  const chatId = await t.mutation((ctx) =>
    ctx.db.insert("chats", {
      threadId,
      type: "study",
      updatedAt: NOW,
      userId,
      visibility: "private",
    })
  );
  return { chatIds: [chatId], t, threadIds: [threadId] };
}

const MiB = 1024 * 1024;

/** Convex's limits for one transaction, enforced on every call of a pass. */
const LIMITS = {
  bytesRead: 16 * MiB,
  bytesWritten: 16 * MiB,
  databaseQueries: 4096,
  documentsRead: 32_000,
  documentsWritten: 16_000,
};

/**
 * Calls the function until its cursor is null, as a pass is run, with Convex's
 * limits for one transaction enforced on every call. It returns every report
 * and the largest share of any limit that a call used.
 */
export async function measuredPass(
  t: Fixture["t"],
  from: typeof OutcomeCursor.Type | null
) {
  let reports: (typeof OutcomeReport.Type)[] = [];
  let peak = 0;
  let cursor = from;
  do {
    const call = await t.mutation(async (ctx) => {
      const report = await ctx.runMutation(
        rewrite,
        { cursor },
        { transactionLimits: LIMITS }
      );
      return { metrics: await ctx.meta.getTransactionMetrics(), report };
    });
    peak = Math.max(
      peak,
      ...Arr.map(
        Rec.values(call.metrics),
        ({ remaining, used }) => used / (used + remaining)
      )
    );
    reports = Arr.append(reports, call.report);
    cursor = call.report.cursor;
  } while (cursor !== null);
  return { peak, reports };
}

/** The reports of a pass, as `measuredPass` returns them. */
export async function pass(
  t: Fixture["t"],
  from: typeof OutcomeCursor.Type | null
) {
  return (await measuredPass(t, from)).reports;
}

/** Every stored message of a thread, oldest first, as the Agent component keeps it. */
export function stored(t: Fixture["t"], threadId: string) {
  return t.query(async (ctx) => {
    const { page } = await ctx.runQuery(
      components.nina.messages.listMessagesByThreadId,
      {
        order: "asc",
        paginationOpts: { cursor: null, numItems: 500 },
        threadId,
      }
    );
    return page;
  });
}

/** The values of the JSON outputs stored in a thread, oldest first. */
export async function outputs(t: Fixture["t"], threadId: string) {
  return Arr.flatMap(await stored(t, threadId), ({ message }) =>
    message?.role === "tool"
      ? Arr.flatMap(message.content, (part) =>
          part.type === "tool-result" && part.output?.type === "json"
            ? [part.output.value]
            : []
        )
      : []
  );
}

/** What each call read and rewrote, without its cursor. */
export function counts(reports: readonly (typeof OutcomeReport.Type)[]) {
  return Arr.map(reports, ({ rewritten, scanned }) => ({ rewritten, scanned }));
}

/** The sum of one count over the calls of a pass. */
export function total(
  reports: readonly (typeof OutcomeReport.Type)[],
  count: "rewritten" | "scanned"
) {
  return Arr.reduce(reports, 0, (sum, report) => sum + report[count]);
}
