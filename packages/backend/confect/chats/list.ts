import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { ChatVisibility } from "@repo/backend/confect/chats/schema";
import { openChats } from "@repo/backend/confect/chats/title";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, String as Str } from "effect";

/**
 * Chats one search page reads, newest first, whatever page size was asked. The
 * database cannot search sealed titles, so a search page opens a window of the
 * learner's chats and keeps those whose title holds every word. A window that
 * stops before the oldest chat comes back with the cursor of the next one, so
 * no chat is out of reach.
 */
export const CHAT_SEARCH_WINDOW = 500;

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
 * page reads `CHAT_SEARCH_WINDOW` chats from the cursor and returns those whose
 * title holds every word, so it may hold more titles than `numItems`, or none
 * while `isDone` is false. The search is over when `isDone` is true.
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
  const scanned = yield* chats
    .paginate({ ...paginationOpts, numItems: CHAT_SEARCH_WINDOW })
    .pipe(Effect.orDie);
  const opened = yield* openChats(userId, scanned.page);
  return {
    ...scanned,
    page: Arr.filter(opened, (chat) => titleHasWords(chat.title, words)),
  };
});
