import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Schema } from "effect";

/**
 * The declared failures that say the chat is not available to this viewer: the
 * viewer is signed out, the account cannot use Nina, or the chat is missing or
 * is not the viewer's. Every other failure is Nakafa's own.
 */
const UnavailableChatSchema = Schema.Union([
  SessionRequired,
  AccountUnavailable,
  ChatAccessError,
]);

/**
 * Whether a read failed because the learner's own chat is gone. The server
 * finds no chat the viewer may read, and the chat it answered before named its
 * owner, which the server does in the owner's chat alone. A chat can stop being
 * the owner's only by being deleted, in another tab or on another device, so the
 * page moves on instead of showing the chat as one the viewer may not read.
 */
export function isDeletedOwnChat(
  error: unknown,
  ownerBefore: Id<"users"> | undefined
) {
  return (
    ownerBefore !== undefined &&
    Schema.is(ChatAccessError)(error) &&
    error.code === "CHAT_NOT_FOUND"
  );
}

/** The card a chat that could not be read shows: its access, or Nakafa's own failure. */
type ChatFailureKind = "access" | "retry";

/**
 * Reads the card of a failed read from the typed failure it threw. Only a
 * declared access failure says the chat is not available to this viewer. Any
 * other failure, a declared one of Nakafa's own or a defect, says Nakafa could
 * not load the chat, and trying again runs the read again. The text of an error
 * never decides it.
 */
export function readChatFailureKind(error: unknown): ChatFailureKind {
  return Schema.is(UnavailableChatSchema)(error) ? "access" : "retry";
}

/**
 * The arguments of a query that reads one chat. The owner reads by the chat id.
 * Anyone else proves access with the share token of the link, so a reader who
 * came by a link sends it in every query that reads the conversation or its
 * messages (ADR 0001).
 */
export function readChatArgs(
  chatId: Id<"chats">,
  shareToken: string | undefined
) {
  return shareToken === undefined ? { chatId } : { chatId, shareToken };
}

/**
 * What the viewer may do in a conversation, the same on every surface. Only the
 * owner continues it, retries an answer or takes its follow-up suggestions. The
 * server names the owner in the chat of the owner alone, so a chat that names
 * none is a reader's, whoever signed in. A chat the learner just started has no
 * owner on record until it loads, so the learner who started it can already
 * write to it.
 */
export function readChatAccess({
  chatUserId,
  loading,
  opening,
  viewerId,
}: {
  chatUserId: Id<"users"> | undefined;
  loading: boolean;
  opening: boolean;
  viewerId: Id<"users"> | undefined;
}) {
  const owner = viewerId !== undefined && chatUserId === viewerId;
  return {
    canWrite: owner || (viewerId !== undefined && loading && opening),
    owner,
  };
}
