import { Ref } from "@confect/core";
import { createThread, saveMessages } from "@convex-dev/agent";
import { researchMaxSources } from "@repo/backend/client/nina/research";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { NINA_BUDGET } from "@repo/backend/confect/nina/budget";
import type {
  OutcomeCursor,
  OutcomeReport,
} from "@repo/backend/confect/nina/outcome.spec";
import { webSearchMaxQueries } from "@repo/backend/confect/nina/research/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { ModelMessage, ToolResultPart } from "ai";
import { Array as Arr } from "effect";

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

/** An output as a capability stored it before 10 October 2026. */
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

/** The tool message that holds one result. */
export function resultOf(
  toolName: string,
  output: ToolResultPart["output"],
  toolCallId = "call-1"
) {
  return {
    role: "tool" as const,
    content: [{ type: "tool-result" as const, toolCallId, toolName, output }],
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
    {
      role: "assistant",
      content: [{ type: "tool-call", toolCallId, toolName, input: {} }],
    },
    resultOf(toolName, output, toolCallId),
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
    return index % 2 === 0
      ? { role: "user", content: `Question ${index}` }
      : { role: "assistant", content: `Answer ${index}` };
  });
}

/**
 * The largest output research can store: the most searches, each with the most
 * sources and a full page of content, the most pages read in full, and the
 * longest text one output may carry.
 */
function heaviest(failure?: string) {
  const searches = Arr.makeBy(webSearchMaxQueries, (query) => ({
    type: "data-web-search" as const,
    id: `search-${query}`,
    data: {
      provider: "firecrawl" as const,
      queries: [`Query ${query}`],
      sources: Arr.makeBy(5, (source) => ({
        citation: `[${source + 1}]`,
        content: "x".repeat(3000),
        description: "A description of the page.",
        title: `Source ${source}`,
        url: `https://example.com/${query}/${source}`,
      })),
      status: "done" as const,
    },
  }));
  const pages = Arr.makeBy(researchMaxSources, (page) => ({
    type: "data-scrape-url" as const,
    id: `scrape-${page}`,
    data: {
      content: "y".repeat(3000),
      status: "done" as const,
      url: `https://example.com/page/${page}`,
    },
  }));
  return {
    artifacts: Arr.appendAll(searches, pages),
    ...(failure === undefined ? {} : { failure }),
    text: "z".repeat(NINA_BUDGET.evidence * 4),
  };
}

/** 25 turns of the heaviest outputs, all of them old or none of them. */
export function heaviestChat(old: boolean) {
  return Arr.flatMap(
    Arr.makeBy(25, (index) => index),
    (index) =>
      turn(
        "deepResearch",
        json(heaviest(old ? "failed" : undefined)),
        `call-${index}`
      )
  );
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

/** Calls the function until its cursor is null, as a pass is run, and returns every report. */
export async function pass(
  t: Fixture["t"],
  from: typeof OutcomeCursor.Type | null
) {
  let reports: (typeof OutcomeReport.Type)[] = [];
  let cursor = from;
  do {
    const report = await t.mutation(rewrite, { cursor });
    reports = Arr.append(reports, report);
    cursor = report.cursor;
  } while (cursor !== null);
  return reports;
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
