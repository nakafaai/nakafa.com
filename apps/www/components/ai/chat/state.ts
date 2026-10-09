import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr } from "effect";

type Chat = Docs["chats"];
type ChatPatch = Partial<Pick<Chat, "title" | "visibility">>;

/** Patch one chat in an immutable query page. */
export function patchChatPage(
  page: Chat[],
  chatId: Id<"chats">,
  patch: ChatPatch
) {
  return Arr.map(page, (chat) =>
    chat._id === chatId ? { ...chat, ...patch } : chat
  );
}

/** Remove one chat from an immutable query page. */
export function removeChatFromPage(page: Chat[], chatId: Id<"chats">) {
  return Arr.filter(page, (chat) => chat._id !== chatId);
}

/**
 * Apply visibility to a loaded own-chat page, removing the row when the query
 * explicitly selects the other visibility.
 */
export function updateOwnChatVisibility(
  page: Chat[],
  chatId: Id<"chats">,
  visibility: Chat["visibility"],
  selectedVisibility?: Chat["visibility"]
) {
  if (selectedVisibility && selectedVisibility !== visibility) {
    return removeChatFromPage(page, chatId);
  }

  return patchChatPage(page, chatId, { visibility });
}
