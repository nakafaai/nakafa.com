import { MAX_TITLE_LENGTH } from "@repo/backend/client/nina/presentation";

/**
 * Chats one page of a chat list holds at most, and how many a list asks for at
 * first and each time its end comes into view. The server cuts a larger request
 * to this.
 */
export const CHAT_LIST_PAGE_SIZE = 50;

/**
 * Chats one search page reads, newest first, whatever page size was asked. The
 * database cannot search sealed titles, so a search page opens a window of the
 * learner's chats and keeps those whose title holds every word. A window that
 * stops before the oldest chat comes back with the cursor of the next one, so
 * no chat is out of reach.
 */
export const CHAT_SEARCH_WINDOW = 500;

/**
 * Windows in a row that hold no match, after which a chat list stops loading
 * the next one by itself and offers to search further. A search that finds
 * nothing reads and opens this many windows of chats and no more, until the
 * learner asks for another.
 */
export const CHAT_SEARCH_EMPTY_WINDOWS = 2;

/**
 * Words of a chat search that count. The database cannot search sealed titles,
 * so every word is looked for in every title of a window, and the words after
 * these are left out.
 */
export const CHAT_SEARCH_WORDS = 8;

/**
 * Characters a chat search holds at most: the words that count, each as long as
 * a title can be, and a space after each. A longer search cannot match more,
 * so the search box takes no more and the server refuses it.
 */
export const CHAT_SEARCH_LENGTH = CHAT_SEARCH_WORDS * (MAX_TITLE_LENGTH + 1);
