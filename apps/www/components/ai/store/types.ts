"use client";

import type { ModelId } from "@repo/ai/config/models";
import type { Id } from "@repo/backend/convex/_generated/dataModel";

export interface AiState {
  activeChatId: Id<"chats"> | null;
  contextTitle: string | null;
  model: ModelId;
  open: boolean;
  pendingQuery: string;
  pendingQueryChatId: Id<"chats"> | null;
  pendingQueryOwner: "page" | "sheet" | null;
  text: string;
}

export interface AiActions {
  clearPendingQuery: () => void;
  getModel: () => AiState["model"];
  queuePendingQuery: (value: {
    chatId: Id<"chats">;
    owner: NonNullable<AiState["pendingQueryOwner"]>;
    query: string;
  }) => void;
  setActiveChatId: (activeChatId: AiState["activeChatId"]) => void;
  setContextTitle: (contextTitle: AiState["contextTitle"]) => void;
  setModel: (model: AiState["model"]) => void;
  setOpen: (open: AiState["open"]) => void;
  setText: (text: AiState["text"]) => void;
}

export type AiStore = AiState & AiActions;
