import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { ChatVisibility } from "@repo/backend/confect/chats/schema";
import { openChats } from "@repo/backend/confect/chats/title";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, String as Str } from "effect";

/**
 * Most chats one search opens, newest first. The database cannot search sealed
 * titles, so a search opens the newest chats of the learner and filters them.
 */
export const CHAT_SEARCH_LIMIT = 500;

/** What separates the words of a search query. */
const SPACES = /\s+/u;

type Chat = Docs["chats"];

/** Finds a learner's chats, newest first, through the narrowest index for the filters. */
const chatsOf = Effect.fn("chats.list.chatsOf")(function* (
  userId: Chat["userId"],
  visibility: ChatVisibility | undefined,
  type: Chat["type"] | undefined
) {
  const chats = (yield* DatabaseReader).table("chats");
  if (visibility && type) {
    return chats.index(
      "by_userId_and_visibility_and_type",
      (q) =>
        q.eq("userId", userId).eq("visibility", visibility).eq("type", type),
      "desc"
    );
  }
  if (type) {
    return chats.index(
      "by_userId_and_type",
      (q) => q.eq("userId", userId).eq("type", type),
      "desc"
    );
  }
  if (visibility) {
    return chats.index(
      "by_userId_and_visibility",
      (q) => q.eq("userId", userId).eq("visibility", visibility),
      "desc"
    );
  }
  return chats.index("by_userId", (q) => q.eq("userId", userId), "desc");
});

/** The lower-case words of a search query, none when the query is blank. */
function searchWords(searchQuery: string | undefined) {
  return Arr.filter(
    Str.split(Str.toLowerCase(Str.trim(searchQuery ?? "")), SPACES),
    Str.isNonEmpty
  );
}

/** Whether a title holds every word of the search, in any order and any case. */
function titleHasWords(title: string | undefined, words: readonly string[]) {
  const text = Str.toLowerCase(title ?? "");
  return Arr.every(words, (word) => Str.includes(word)(text));
}

/**
 * Reads one page of one learner's chats with their titles opened. A search
 * opens the newest `CHAT_SEARCH_LIMIT` chats, keeps those whose title holds
 * every word, and returns the first `numItems` of them as a page that has no
 * next page.
 */
export const listChats = Effect.fn("chats.list.page")(function* (list: {
  readonly paginationOpts: PaginationOptions;
  readonly q?: string | undefined;
  readonly type?: Chat["type"] | undefined;
  readonly userId: Chat["userId"];
  readonly visibility?: ChatVisibility | undefined;
}) {
  const { paginationOpts, userId } = list;
  const chats = yield* chatsOf(userId, list.visibility, list.type);
  const words = searchWords(list.q);
  if (Arr.isReadonlyArrayEmpty(words)) {
    const page = yield* chats.paginate(paginationOpts).pipe(Effect.orDie);
    return { ...page, page: yield* openChats(userId, page.page) };
  }
  const newest = yield* chats.take(CHAT_SEARCH_LIMIT).pipe(Effect.orDie);
  const opened = yield* openChats(userId, newest);
  return {
    continueCursor: "",
    isDone: true,
    page: Arr.take(
      Arr.filter(opened, (chat) => titleHasWords(chat.title, words)),
      paginationOpts.numItems
    ),
  };
});
