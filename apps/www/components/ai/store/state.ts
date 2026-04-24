"use client";

import type { AiState } from "@/components/ai/store/types";

export const initialState = {
  activeChatId: null,
  contextTitle: null,
  model: "kimi-k2.5",
  open: false,
  pendingQuery: "",
  pendingQueryChatId: null,
  pendingQueryOwner: null,
  text: "",
} satisfies AiState;
