"use client";

import { PaginatedQueryResult } from "@confect/react";
import { useState } from "react";

/** How many chats a list loads at first, and with each press of Show more. */
export const CHAT_LIST_PAGE_SIZE = 50;

/**
 * The chats a list shows, from the paginated query it reads. While the first
 * page of a new search loads, the rows of the search before it stay, so the
 * list never goes blank or fills with placeholder rows. `loadMore` is there
 * only while another page can be loaded, and `loadingMore` holds its place
 * while that page arrives.
 */
export function useChatList<Item, E>(
  pagination: PaginatedQueryResult.Variants<Item, E>
) {
  const [settled, setSettled] = useState(pagination.results);
  const loadingFirstPage = PaginatedQueryResult.isLoadingFirstPage(pagination);
  if (!loadingFirstPage && settled !== pagination.results) {
    setSettled(pagination.results);
  }

  return {
    loadMore: PaginatedQueryResult.isCanLoadMore(pagination)
      ? () => pagination.loadMore(CHAT_LIST_PAGE_SIZE)
      : undefined,
    loadingMore: PaginatedQueryResult.isLoadingMore(pagination),
    results: loadingFirstPage ? settled : pagination.results,
  };
}
