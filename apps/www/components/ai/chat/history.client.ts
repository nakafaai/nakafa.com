"use client";

import type { PaginatedQueryResult } from "@confect/react";
import { useState } from "react";
import { readChatList } from "@/components/ai/chat/history";

/**
 * The chats a list shows, from the paginated query it reads. It remembers the
 * rows of the last page that loaded, which the list keeps showing while a new
 * search is still loading its first page.
 */
export function useChatList<Item, E>(
  pagination: PaginatedQueryResult.Variants<Item, E>
) {
  const [settled, setSettled] = useState(pagination.results);
  const list = readChatList(settled, pagination);
  if (list.results !== settled) {
    setSettled(list.results);
  }
  return list;
}
