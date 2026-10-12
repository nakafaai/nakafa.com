import type { Id } from "@repo/backend/convex/_generated/dataModel";

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
