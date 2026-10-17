import { createThread, saveMessage, saveMessages } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { ToolCallPart, ToolResultPart } from "ai";

const NOW = Date.UTC(2026, 8, 27, 12);

/** The messages Nina saves for one turn, after the learner's prompt. */
type Turn = Parameters<typeof saveMessages>[2]["messages"];

const mathCall: ToolCallPart = {
  type: "tool-call",
  toolCallId: "math-1",
  toolName: "math",
  input: { expression: "1+1" },
};
const mathResult: ToolResultPart = {
  type: "tool-result",
  toolCallId: "math-1",
  toolName: "math",
  output: {
    type: "json",
    value: {
      text: "2",
      artifacts: [{ type: "data-math", id: "math-1", data: { primary: "2" } }],
    },
  },
};
const reasoning = {
  type: "reasoning" as const,
  text: "Check the expression.",
  providerOptions: { gateway: { signature: "continuation" } },
};

/** A turn in which Nina did a sum and answered. */
const MATH_TURN: Turn = [
  { role: "assistant", content: [reasoning, mathCall] },
  { role: "tool", content: [mathResult] },
  { role: "assistant", content: "The value is 2." },
];

/**
 * A search of the learner's memory, as the thread stores it. Its query and its
 * note hold words of their own, so a page that leaked either can be told from
 * one that did not.
 */
export const SEARCH = {
  id: "recall-1",
  query: "when is my exam",
  text: "Saved memories matched this query, but their words are not kept in the conversation.",
};
const searchCall: ToolCallPart = {
  type: "tool-call",
  toolCallId: SEARCH.id,
  toolName: "memory",
  input: { query: SEARCH.query },
};
const searchResult: ToolResultPart = {
  type: "tool-result",
  toolCallId: SEARCH.id,
  toolName: "memory",
  output: { type: "json", value: { artifacts: [], text: SEARCH.text } },
};

/** A turn in which Nina did a sum, searched the memory in the same step, and answered. */
export const MEMORY_TURN: Turn = [
  { role: "assistant", content: [reasoning, mathCall, searchCall] },
  { role: "tool", content: [mathResult, searchResult] },
  { role: "assistant", content: "The value is 2." },
];

/** A turn that has searched the memory and has nothing else yet. */
export const SEARCHING_TURN: Turn = [
  { role: "assistant", content: [searchCall] },
];

/**
 * A private chat of a learner, with the thread the Agent component keeps for it:
 * the learner's prompt, and the messages of one turn. It returns the test
 * backend, the learner's own session, the chat, the id of the prompt that the
 * Agent saved, and the arguments that read the chat's first page of messages.
 */
export async function createThreadTest(turn: Turn = MATH_TURN) {
  const t = createConvexTestWithBetterAuth();
  const { identity, promptMessageId } = await t.mutation(async (ctx) => {
    const user = await seedAuthenticatedUser(ctx, { now: NOW });
    const threadId = await createThread(ctx, components.nina, {
      userId: user.userId,
    });
    const chatId = await ctx.db.insert("chats", {
      threadId,
      type: "study",
      userId: user.userId,
      updatedAt: NOW,
      visibility: "private",
    });
    const prompt = await saveMessage(ctx, components.nina, {
      threadId,
      prompt: "Explain a limit.",
    });
    await saveMessages(ctx, components.nina, {
      threadId,
      promptMessageId: prompt.messageId,
      messages: turn,
    });
    return {
      identity: { ...user, chatId, threadId },
      promptMessageId: prompt.messageId,
    };
  });
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  return {
    t,
    owner,
    identity,
    promptMessageId,
    args: {
      chatId: identity.chatId,
      threadId: identity.threadId,
      paginationOpts: { cursor: null, numItems: 20 },
    },
  };
}

/** Starts a stream on the thread of the chat, as a running turn does, and writes "Live" to it. */
export function startStream(f: Awaited<ReturnType<typeof createThreadTest>>) {
  return f.t.mutation(async (ctx) => {
    const streamId = await ctx.runMutation(components.nina.streams.create, {
      threadId: f.identity.threadId,
      userId: f.identity.userId,
      order: 1,
      stepOrder: 0,
      format: "UIMessageChunk",
    });
    await ctx.runMutation(components.nina.streams.addDelta, {
      streamId,
      start: 0,
      end: 1,
      parts: [{ type: "text-delta", id: "text-1", delta: "Live" }],
    });
    return streamId;
  });
}
