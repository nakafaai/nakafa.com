"use client";

import type { AiState } from "@/components/ai/store/types";

export const initialState = {
  activeChatId: null,
  ask: null,
  chatDrafts: [],
  contextTitle: null,
  held: {},
  open: false,
  openingChat: null,
  text: "",
  uploads: {},
  warmed: false,
} satisfies AiState;
