import { PaginatedQueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import {
  CHAT_LIST_PAGE_SIZE,
  readChatList,
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
