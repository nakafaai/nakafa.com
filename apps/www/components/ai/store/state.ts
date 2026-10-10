"use client";

import type { AiState } from "@/components/ai/store/types";

export const initialState = {
  activeChatId: null,
  ask: null,
  chatDrafts: [],
  contextTitle: null,
  open: false,
  openingChat: null,
  sheetActivated: false,
  text: "",
} satisfies AiState;
