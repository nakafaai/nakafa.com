import { PaginatedQueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import {
  CHAT_LIST_PAGE_SIZE,
  CHAT_SEARCH_EMPTY_WINDOWS,
} from "@repo/backend/client/chats/list";
import { HashSet } from "effect";
import {
  emptyWindows,
  readChatList,
  searchStopped,
} from "@/components/ai/chat/history";

const settled = ["Limits", "Vectors"];

/** The ids of the chats a list held when a window was asked for. */
const ids = (...held: string[]) => HashSet.fromIterable(held);

describe("chat/history", () => {
  it("keeps the rows it settled on while a new search loads its first page", () => {
    const list = readChatList(
      settled,
      PaginatedQueryResult.loadingFirstPage({ skipped: false })
    );

    expect(list.results).toBe(settled);
    expect(list.loadMore).toBeUndefined();
  });

  it("shows the rows of a page that loaded, in place of the settled ones", () => {
    const loaded = ["Integrals"];

    expect(
      readChatList(settled, PaginatedQueryResult.exhausted({ results: loaded }))
        .results
    ).toBe(loaded);
  });

  it("offers one more page of chats only while another page can load", () => {
    const loadMore = vi.fn<(numItems: number) => void>();
    const list = readChatList(
      settled,
      PaginatedQueryResult.canLoadMore({ loadMore, results: settled })
    );

    expect(list.loadMore).toBeDefined();
    list.loadMore?.();

    expect(loadMore).toHaveBeenCalledExactlyOnceWith(CHAT_LIST_PAGE_SIZE);
  });

  it("offers no second page while the next one loads, and shows the rows loaded so far", () => {
    const loaded = [...settled, "Integrals"];
    const list = readChatList(
      settled,
      PaginatedQueryResult.loadingMore({ results: loaded })
    );

    expect(list.loadMore).toBeUndefined();
    expect(list.results).toBe(loaded);
  });

  it("offers nothing more once every chat has loaded", () => {
    const list = readChatList(
      settled,
      PaginatedQueryResult.exhausted({ results: settled })
    );

    expect(list.loadMore).toBeUndefined();
  });
});

describe("chat/history search windows", () => {
  it("counts a window as empty when it added no chat to the list", () => {
    expect(emptyWindows(ids(), 0, [])).toBe(1);
    expect(emptyWindows(ids("a", "b", "c"), 1, ["a", "b", "c"])).toBe(2);
    expect(emptyWindows(ids("a", "b", "c"), 1, ["a", "b", "c", "d"])).toBe(0);
  });

  it("counts the chats a window brought and not how many the list holds, when a chat left the list while it loaded", () => {
    // "c" was deleted in another tab and the window brought nothing.
    expect(emptyWindows(ids("a", "b", "c"), 1, ["a", "b"])).toBe(2);
    // "c" was deleted and the window brought "d": the list holds as many chats
    // as when the window was asked for, and the window still held a match.
    expect(emptyWindows(ids("a", "b", "c"), 1, ["a", "b", "d"])).toBe(0);
  });

  it("stops asking by itself after the windows in a row that hold no match", () => {
    const stoppedAfter = (earlier: number) =>
      searchStopped(ids("a"), earlier, ["a"]);
    // A window short of the limit: the list asks for the next one by itself.
    expect(stoppedAfter(CHAT_SEARCH_EMPTY_WINDOWS - 2)).toBe(false);
    // The window that reaches the limit stops it, and each one after that
    // holds none too, so the learner keeps asking.
    expect(stoppedAfter(CHAT_SEARCH_EMPTY_WINDOWS - 1)).toBe(true);
    expect(stoppedAfter(CHAT_SEARCH_EMPTY_WINDOWS)).toBe(true);
  });

  it("starts counting again when a window holds a match", () => {
    // The list held two chats when a late window was asked for, and holds a
    // third now: the windows before it do not count.
    expect(
      searchStopped(ids("a", "b"), CHAT_SEARCH_EMPTY_WINDOWS + 3, [
        "a",
        "b",
        "c",
      ])
    ).toBe(false);
    // The window before found one, so as many windows without a match are
    // needed again before the list stops.
    const listed = ["a", "b", "c"];
    expect(searchStopped(ids(...listed), 0, listed)).toBe(false);
    expect(
      searchStopped(ids(...listed), CHAT_SEARCH_EMPTY_WINDOWS - 1, listed)
    ).toBe(true);
  });
});
