"use client";

import type { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import type refs from "@repo/backend/confect/_generated/refs";
import { ModelId } from "@repo/backend/confect/gateway/model";
import { NinaReceipt } from "@repo/backend/confect/nina/turns.spec";
import { Schema } from "effect";

/** A prompt Nina is admitting for the learner, shown before its chat exists. */
const AiAskSchema = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
});

export type AiAsk = typeof AiAskSchema.Type;

const AiStateSchema = Schema.Struct({
  activeChatId: Schema.NullOr(Id("chats")),
  ask: Schema.NullOr(AiAskSchema),
  chatDrafts: Schema.Array(Schema.String),
  contextTitle: Schema.NullOr(Schema.String),
  model: ModelId,
  open: Schema.Boolean,
  openingChat: Schema.NullOr(
    Schema.Struct({
      receipt: NinaReceipt,
      prompt: NinaReceipt.fields.prompt,
      submittedAt: Schema.Finite,
    })
  ),
  sheetActivated: Schema.Boolean,
  text: Schema.String,
});

export type AiState = typeof AiStateSchema.Type;

export interface AiActions {
  addChatDraft: (key: string) => void;
  getModel: () => AiState["model"];
  openAsk: (ask: AiAsk) => boolean;
  removeChatDraft: (key: string) => void;
  resolveAsk: (id: AiAsk["id"], chatId: AiState["activeChatId"]) => void;
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
