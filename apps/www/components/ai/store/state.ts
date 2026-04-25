"use client";

import { defaultModel } from "@repo/ai/config/models";
import type { AiState } from "@/components/ai/store/types";

export const initialState = {
  activeChatId: null,
  chatSession: null,
  contextTitle: null,
  model: defaultModel,
  open: false,
  text: "",
} satisfies AiState;
