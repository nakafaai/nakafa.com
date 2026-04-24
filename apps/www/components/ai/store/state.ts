"use client";

import type { AiState } from "@/components/ai/store/types";

export const initialState = {
  activeChatId: null,
  chatSession: null,
  contextTitle: null,
  model: "kimi-k2.5",
  open: false,
  text: "",
} satisfies AiState;
