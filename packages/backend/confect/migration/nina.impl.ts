import { FunctionImpl, GroupImpl } from "@confect/server";
import { createThread, saveMessages } from "@convex-dev/agent";
import type { MessageWithMetadata } from "@convex-dev/agent/validators";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/migration/nina.spec";
import {
  NinaMigrationError,
  projectTranscript,
} from "@repo/backend/confect/migration/parts";
import {
  NinaSettledTurn,
  NinaUnansweredTurn,
} from "@repo/backend/confect/nina/turns.spec";
import { Effect, Layer, Schema, Struct } from "effect";

const fail = (message: string) =>
  new NinaMigrationError({ message, cause: undefined });

const recordUnanswered = Effect.fn("migration.nina.unanswered")(function* (
  prompt: { id: string; source: Docs["messages"] },
  userId: Docs["users"]["_id"],
  threadId: string,
  order: number
) {
  const facts = yield* Schema.decodeEffect(NinaUnansweredTurn)({
    phase: "unanswered",
    state: { status: "unanswered" },
    userId,
    threadId,
    chatId: prompt.source.chatId,
    order,
    promptMessageId: prompt.id,
    promptedAt: prompt.source._creationTime,
    usage: [],
    ...Struct.renameKeys(
      Struct.pick(prompt.source, [
        "ninaContextSnapshot",
        "ninaContextTransition",
      ]),
      { ninaContextSnapshot: "snapshot", ninaContextTransition: "transition" }
    ),
  });
  yield* (yield* DatabaseWriter).table("ninaTurns").insert(facts);
});

const list = FunctionImpl.make(
  schema,
  spec,
  "list",
  Effect.fn("migration.nina.list")(function* ({ paginationOpts }) {
    const page = yield* (yield* DatabaseReader)
      .table("chats")
      .index("by_creation_time")
      .paginate(paginationOpts);
    return {
      chatIds: page.page
        .filter((chat) => !chat.threadId)
        .map((chat) => chat._id),
      cursor: page.continueCursor,
      done: page.isDone,
    };
  }, Effect.orDie)
);

const recordResponse = Effect.fn("migration.nina.response")(function* (
  message: Docs["messages"],
  {
    userId,
    threadId,
    order,
    prompt,
    suggestions,
    messageId,
    ledger,
  }: {
    userId: Docs["users"]["_id"];
    threadId: string;
    order: number;
    prompt: { id: string; createdAt: number };
    suggestions: string[];
    messageId: string;
    ledger: readonly Docs["creditTransactions"][];
  }
) {
  const writer = yield* DatabaseWriter;
  const transaction = ledger.find(
    (row) => row.metadata?.messageId === message._id && row.type === "usage"
  );
  const facts = yield* Schema.decodeEffect(NinaSettledTurn)({
    phase: "settled",
    chatId: message.chatId,
    userId,
    threadId,
    order,
    promptMessageId: prompt.id,
    promptedAt: prompt.createdAt,
    ...Struct.pick(message, ["credits", "modelId"]),
    ...Struct.renameKeys(
      Struct.pick(message, ["ninaContextSnapshot", "ninaContextTransition"]),
      {
        ninaContextSnapshot: "snapshot",
        ninaContextTransition: "transition",
      }
    ),
    tokens: Struct.renameKeys(
      Struct.pick(message, ["inputTokens", "outputTokens", "totalTokens"]),
      {
        inputTokens: "input",
        outputTokens: "output",
        totalTokens: "total",
      }
    ),
    usage: [],
    ...(transaction ? { transactionId: transaction._id } : {}),
    ...(suggestions.length ? { suggestions } : {}),
    state:
      message.generationStatus === "failed"
        ? {
            status: "failed",
            reason: "unknown",
            finishedAt: message._creationTime,
          }
        : { status: "complete", finishedAt: message._creationTime },
  });
  const turnId = yield* writer.table("ninaTurns").insert(facts);
  for (const row of ledger) {
    if (row.metadata?.messageId === message._id) {
      yield* writer.table("creditTransactions").patch(row._id, {
        metadata: { ...row.metadata, messageId, turnId },
      });
    }
  }
});

const commitMessage = Effect.fn("migration.nina.message")(function* (
  message: Docs["messages"],
  threadId: string,
  userId: Docs["users"]["_id"],
  order: number
) {
  const reader = yield* DatabaseReader;
  const ctx = yield* MutationCtx;
  const parts = yield* reader
    .table("messageParts")
    .index("by_messageId_and_order", (q) => q.eq("messageId", message._id))
    .take(201);
  if (parts.length > 200) {
    return yield* fail("Message exceeds the verified part conversion bound.");
  }
  const projected = yield* projectTranscript(message, parts, threadId, userId);
  const messages = projected.rows.map((row) => row.message);
  const metadata: Omit<MessageWithMetadata, "message">[] = projected.rows.map(
    (row) => ({
      ...Struct.pick(row, [
        "providerMetadata",
        "sources",
        "reasoning",
        "reasoningDetails",
      ]),
      status: message.generationStatus === "failed" ? "failed" : "success",
    })
  );
  if (messages.length === 0) {
    if (message.role !== "assistant" || message.generationStatus !== "failed") {
      return yield* fail("An empty message has no recorded failure.");
    }
    messages.push({ role: "assistant", content: "" });
    metadata.push({ status: "failed" });
  }
  const saved = yield* Effect.tryPromise({
    try: () =>
      saveMessages(ctx, components.nina, {
        threadId,
        userId,
        order,
        messages,
        metadata,
      }),
    catch: () => fail("Unable to save the Agent messages."),
  });
  const first = saved.messages[0];
  if (!first) {
    return yield* fail("Agent did not commit a converted message.");
  }
  return {
    first,
    count: saved.messages.length,
    suggestions: projected.suggestions,
  };
});

const readSnapshot = Effect.fn("migration.nina.snapshot")(function* (
  chat: Docs["chats"]
) {
  const reader = yield* DatabaseReader;
  const source = yield* reader
    .table("messages")
    .index("by_chatId", (q) => q.eq("chatId", chat._id))
    .take(101);
  if (source.length > 100) {
    return yield* fail("Chat exceeds the verified atomic conversion bound.");
  }
  const ledger = yield* reader
    .table("creditTransactions")
    .index("by_userId", (q) => q.eq("userId", chat.userId))
    .take(501);
  if (ledger.length > 500) {
    return yield* fail("Account exceeds the verified ledger conversion bound.");
  }
  return { source, ledger };
});

const commitTranscript = Effect.fn("migration.nina.transcript")(function* (
  chat: Docs["chats"],
  source: readonly Docs["messages"][],
  ledger: readonly Docs["creditTransactions"][],
  threadId: string
) {
  const [opening, ...remaining] = source;
  if (!opening) {
    return { messages: 0, turns: 0 };
  }
  if (opening.role !== "user") {
    return yield* fail("The transcript has no original user prompt.");
  }
  const initial = yield* commitMessage(opening, threadId, chat.userId, 0);
  let prompt = {
    id: initial.first._id,
    createdAt: opening._creationTime,
    source: opening,
  };
  let order = 0;
  let previousRole: Docs["messages"]["role"] = "user";
  let written = initial.count;
  let turns = 0;
  for (const message of remaining) {
    if (message.role === "user" && previousRole === "user") {
      yield* recordUnanswered(prompt, chat.userId, threadId, order);
      turns += 1;
    }
    if (message.role === "user" || previousRole === "assistant") {
      order += 1;
    }
    const { first, count, suggestions } = yield* commitMessage(
      message,
      threadId,
      chat.userId,
      order
    );
    written += count;
    if (message.role === "user") {
      prompt = {
        id: first._id,
        createdAt: message._creationTime,
        source: message,
      };
    }
    if (message.role === "assistant") {
      yield* recordResponse(message, {
        userId: chat.userId,
        threadId,
        order,
        prompt,
        suggestions,
        messageId: first._id,
        ledger,
      });
      turns += 1;
    }
    previousRole = message.role;
  }
  if (previousRole === "user") {
    yield* recordUnanswered(prompt, chat.userId, threadId, order);
    turns += 1;
  }
  return { messages: written, turns };
});

/** A complete chat converts atomically. The original rows remain until acceptance. */
const convert = FunctionImpl.make(
  schema,
  spec,
  "convert",
  Effect.fn("migration.nina.convert")(function* ({ chatId }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const ctx = yield* MutationCtx;
    const chat = yield* reader.table("chats").get(chatId);
    if (chat.threadId) {
      return { threadId: chat.threadId, messages: 0, turns: 0 };
    }
    const active = yield* reader
      .table("chatTurns")
      .index("by_userId", (q) => q.eq("userId", chat.userId))
      .take(1);
    if (active.length) {
      return yield* fail("A response is still running in this chat.");
    }
    const { source, ledger } = yield* readSnapshot(chat);
    const threadId = yield* Effect.tryPromise({
      try: () =>
        createThread(ctx, components.nina, {
          userId: chat.userId,
          ...Struct.pick(chat, ["title"]),
        }),
      catch: () => fail("Unable to create the Agent thread."),
    });
    const result = yield* commitTranscript(chat, source, ledger, threadId);
    yield* writer.table("chats").patch(chatId, { threadId });
    return { threadId, ...result };
  }, Effect.orDie)
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(list),
  Layer.provide(convert),
  GroupImpl.finalize
);
