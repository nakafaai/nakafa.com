import type { ChatView } from "@repo/backend/confect/chats/view";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Option, Result } from "effect";

type Chat = ChatView;
type ChatPatch = Partial<Pick<Chat, "title" | "visibility">>;

/**
 * The loaded entries of `queries`, the result of `getAllQueries` of an
 * optimistic store, that belong to one chat, with their values unwrapped. The
 * arguments of a query are its key, and a reader who opens a chat through a
 * share link asks with the token as well. The owner who opens their own chat
 * that way holds it under other arguments than `{ chatId }`, so a lookup by
 * those exact arguments would miss it. Matching on the chat id finds it either
 * way.
 */
export function loadedForChat<
  Args extends { readonly chatId: Id<"chats"> },
  Value,
>(
  queries: readonly {
    readonly args: Args;
    readonly value: Option.Option<Value>;
  }[],
  chatId: Id<"chats">
) {
  return Arr.filterMap(queries, ({ args, value }) =>
    args.chatId === chatId && Option.isSome(value)
      ? Result.succeed({ args, value: value.value })
      : Result.failVoid
  );
}

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
