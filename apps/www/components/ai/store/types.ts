"use client";

import type { Chat } from "@ai-sdk/react";
import type { ModelId } from "@repo/ai/config/models";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Id } from "@repo/backend/convex/_generated/dataModel";

export interface AiState {
  activeChatId: Id<"chats"> | null;
  chatSession: {
    chatId: Id<"chats">;
    runtime: Chat<MyUIMessage>;
  } | null;
  contextTitle: string | null;
  model: ModelId;
  open: boolean;
  text: string;
}

export interface AiActions {
  getModel: () => AiState["model"];
  setActiveChatId: (activeChatId: AiState["activeChatId"]) => void;
  setChatSession: (chatSession: AiState["chatSession"]) => void;
  setContextTitle: (contextTitle: AiState["contextTitle"]) => void;
  setModel: (model: AiState["model"]) => void;
  setOpen: (open: AiState["open"]) => void;
  setText: (text: AiState["text"]) => void;
}

export type AiStore = AiState & AiActions;
