"use client";

import type { Ref } from "@confect/core";
import { NinaReceipt } from "@repo/backend/client/nina/receipt";
import { Id } from "@repo/backend/confect/_generated/id";
import type nina from "@repo/backend/confect/_generated/refs/nina";
import { Schema } from "effect";

/** A prompt Nina is admitting for the learner, shown before its chat exists. */
const AiAskSchema = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
});

type AiAsk = typeof AiAskSchema.Type;

/** The two states of an upload that a chip shows: on its way, or failed. */
const AiUploadSchema = Schema.Literals(["uploading", "error"]);

const AiStateSchema = Schema.Struct({
  activeChatId: Schema.NullOr(Id("chats")),
  ask: Schema.NullOr(AiAskSchema),
  chatDrafts: Schema.Array(Schema.String),
  contextTitle: Schema.NullOr(Schema.String),
  open: Schema.Boolean,
  openingChat: Schema.NullOr(
    Schema.Struct({
      receipt: NinaReceipt,
      prompt: NinaReceipt.fields.prompt,
      submittedAt: Schema.Finite,
    })
  ),
  text: Schema.String,
  /**
   * The uploads that are on their way or failed, by the preview address of the
   * file that holds them. A file with neither has no entry.
   */
  uploads: Schema.Record(Schema.String, AiUploadSchema),
  /** Whether the sheet's body may render ahead of the press that opens it. */
  warmed: Schema.Boolean,
});

export type AiState = typeof AiStateSchema.Type;

interface AiActions {
  addChatDraft: (key: string) => void;
  clearUpload: (url: string) => void;
  markUpload: (url: string, status: typeof AiUploadSchema.Type) => void;
  openAsk: (ask: AiAsk) => boolean;
  removeChatDraft: (key: string) => void;
  resolveAsk: (id: AiAsk["id"], chatId: AiState["activeChatId"]) => void;
  resolveChatDraft: (
    key: string,
    receipt: Ref.Returns<typeof nina.turns.start>
  ) => void;
  setActiveChatId: (activeChatId: AiState["activeChatId"]) => void;
  setContextTitle: (contextTitle: AiState["contextTitle"]) => void;
  setOpen: (open: AiState["open"]) => void;
  setOpeningChat: (openingChat: AiState["openingChat"]) => void;
  setText: (text: AiState["text"] | ((previous: string) => string)) => void;
  warm: () => void;
}

export type AiStore = AiState & AiActions;
