"use client";

import { defaultModel } from "@repo/backend/confect/gateway/model";
import type { AiState } from "@/components/ai/store/types";

export const initialState = {
  activeChatId: null,
  ask: null,
  chatDrafts: [],
  contextTitle: null,
  model: defaultModel,
  open: false,
  openingChat: null,
  text: "",
} satisfies AiState;
