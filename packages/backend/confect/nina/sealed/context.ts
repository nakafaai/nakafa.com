import {
  filterOutOrphanedToolMessages,
  type MessageDoc,
} from "@convex-dev/agent";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  readMessageFromAction,
  readThreadFromAction,
} from "@repo/backend/confect/nina/sealed/action";
import { toModelMessages } from "@repo/backend/confect/nina/sealed/model";
import type { ThreadRead } from "@repo/backend/confect/nina/sealed/thread";
import { Array as Arr, Effect, Option, Order } from "effect";

type LearnerId = Docs["users"]["_id"];

/** Most messages the boundary read may take to finish the oldest order of a window. */
const MAX_BOUNDARY_MESSAGES = 1000;

/** The rows of a thread, oldest first, by order and then by step. */
const oldestFirst = Arr.sort(
  Order.combine(
    Order.mapInput(Order.Number, (doc: MessageDoc) => doc.order),
    Order.mapInput(Order.Number, (doc: MessageDoc) => doc.stepOrder)
  )
);

/** Drops every message of the oldest order when the window does not start at its first step. */
function trimIncompleteOldest(docs: MessageDoc[]) {
  const oldest = Arr.head(docs);
  if (Option.isNone(oldest) || oldest.value.stepOrder === 0) {
    return docs;
  }
  return Arr.filter(docs, (doc) => doc.order !== oldest.value.order);
}

/**
 * The newest `recentMessages` successful messages of a thread up to and including
 * the prompt, with the rest of the oldest order when the window cut it short.
 * This is the window the Agent's own context fetch reads, so the model receives
 * the same messages as before the rows were sealed.
 */
const readWindow = Effect.fn("nina.sealed.window")(function* (
  read: Omit<ThreadRead, "paginationOpts">,
  recentMessages: number
) {
  const first = yield* readThreadFromAction({
    ...read,
    paginationOpts: { cursor: null, numItems: recentMessages },
    statuses: ["success"],
  });
  const boundary = yield* boundaryOf(read, first);
  return filterOutOrphanedToolMessages(
    trimIncompleteOldest(oldestFirst([...first.page, ...boundary]))
  );
});

/**
 * The rest of the oldest order of a window that a read cut short: one more read
 * from the window's cursor, for the steps of that order that the window missed.
 * Nothing is read when the window holds no message, when it holds the first
 * step, or when it is the whole thread.
 */
const boundaryOf = Effect.fn("nina.sealed.boundary")(function* (
  read: Omit<ThreadRead, "paginationOpts">,
  first: {
    readonly continueCursor: string;
    readonly isDone: boolean;
    readonly page: readonly MessageDoc[];
  }
) {
  const oldest = Arr.last(first.page);
  if (Option.isNone(oldest) || first.isDone || oldest.value.stepOrder === 0) {
    return [];
  }
  const rest = yield* readThreadFromAction({
    ...read,
    paginationOpts: {
      cursor: first.continueCursor,
      numItems: Math.min(oldest.value.stepOrder, MAX_BOUNDARY_MESSAGES),
    },
    statuses: ["success"],
  });
  return Arr.filter(rest.page, (doc) => doc.order === oldest.value.order);
});

/**
 * The model messages of the recent context of a turn: the window before its
 * prompt, the prompt, and the answers after it. A prompt the window does not hold
 * leaves the whole window before the turn.
 */
export const readRecentContext = Effect.fn("nina.sealed.context")(function* (
  owner: LearnerId,
  read: {
    readonly excludeToolMessages: boolean;
    readonly promptMessageId: string;
    readonly recentMessages: number;
    readonly threadId: string;
  }
) {
  const recent = yield* readWindow(
    {
      excludeToolMessages: read.excludeToolMessages,
      owner,
      threadId: read.threadId,
      upToAndIncludingMessageId: read.promptMessageId,
    },
    read.recentMessages
  );
  const index = Arr.findFirstIndex(
    recent,
    (doc) => doc._id === read.promptMessageId
  );
  const [before, from] = Arr.splitAt(
    recent,
    Option.getOrElse(index, () => recent.length)
  );
  return {
    existingResponses: toModelMessages(Arr.drop(from, 1)),
    inputPrompt: toModelMessages(Arr.take(from, 1)),
    recent: toModelMessages(before),
  };
});

/**
 * The model input of a turn's prompt, read on its own: the prompt when it is a
 * successful message, and nothing when it is not, as a window that holds only
 * successful messages gives none for it.
 */
export const readPromptInput = Effect.fn("nina.sealed.prompt")(function* (
  owner: LearnerId,
  promptMessageId: string
) {
  const prompt = yield* readMessageFromAction(owner, promptMessageId);
  if (prompt?.status !== "success") {
    return [];
  }
  return toModelMessages([prompt]);
});
