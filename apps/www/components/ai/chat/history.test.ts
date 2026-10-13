import { PaginatedQueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import {
  CHAT_LIST_PAGE_SIZE,
  CHAT_SEARCH_EMPTY_WINDOWS,
} from "@repo/backend/client/chats/list";
import {
  emptyWindows,
  readChatList,
  searchStopped,
} from "@/components/ai/chat/history";

const settled = ["Limits", "Vectors"];

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
  it("counts a window as empty when the list holds no more chats than when it was asked for", () => {
    expect(emptyWindows(0, 0, 0)).toBe(1);
    expect(emptyWindows(3, 1, 3)).toBe(2);
    expect(emptyWindows(3, 1, 2)).toBe(2);
    expect(emptyWindows(3, 1, 4)).toBe(0);
  });

  it("stops asking by itself after the windows in a row that hold no match", () => {
    expect(CHAT_SEARCH_EMPTY_WINDOWS).toBe(2);
    // The first window held no match: the list asks for the second by itself.
    expect(searchStopped(0, 0, 0)).toBe(false);
    // The second held none either: the learner asks for the third.
    expect(searchStopped(0, 1, 0)).toBe(true);
    // Each window after that holds none too, so the learner keeps asking.
    expect(searchStopped(0, 2, 0)).toBe(true);
  });

  it("starts counting again when a window holds a match", () => {
    // The list held two chats when the third window was asked for, and holds
    // three now.
    expect(searchStopped(2, 5, 3)).toBe(false);
    // The window before found one, so two windows without a match are needed
    // again before the list stops.
    expect(searchStopped(3, 0, 3)).toBe(false);
    expect(searchStopped(3, 1, 3)).toBe(true);
  });
});
