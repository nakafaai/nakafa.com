"use client";

import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";
import type { ModelId } from "@repo/backend/confect/nina/config/model";
import type { Id } from "@repo/backend/convex/_generated/dataModel";

/** A prompt Nina is admitting for the learner, shown before its chat exists. */
export interface AiAsk {
  id: string;
  text: string;
}

export interface AiState {
  activeChatId: Id<"chats"> | null;
  ask: AiAsk | null;
  chatDrafts: string[];
  contextTitle: string | null;
  model: ModelId;
  open: boolean;
  openingChat: {
    receipt: Ref.Returns<typeof refs.public.nina.turns.start>;
    prompt: Ref.Returns<typeof refs.public.nina.turns.start>["prompt"];
    submittedAt: number;
  } | null;
  sheetActivated: boolean;
  text: string;
}

export interface AiActions {
  addChatDraft: (key: string) => void;
  getModel: () => AiState["model"];
  openAsk: (ask: AiAsk) => boolean;
  removeChatDraft: (key: string) => void;
  resolveAsk: (id: AiAsk["id"], chatId: Id<"chats"> | null) => void;
  resolveChatDraft: (
    key: string,
    receipt: Ref.Returns<typeof refs.public.nina.turns.start>
  ) => void;
  setActiveChatId: (activeChatId: AiState["activeChatId"]) => void;
  setContextTitle: (contextTitle: AiState["contextTitle"]) => void;
  setModel: (model: AiState["model"]) => void;
  setOpen: (open: AiState["open"]) => void;
  setOpeningChat: (openingChat: AiState["openingChat"]) => void;
  setText: (text: AiState["text"] | ((previous: string) => string)) => void;
}

export type AiStore = AiState & AiActions;
