"use client";

import type { Ref } from "@confect/core";
import { NinaReceipt } from "@repo/backend/client/nina/receipt";
import { Id } from "@repo/backend/confect/_generated/id";
import type nina from "@repo/backend/confect/_generated/refs/nina";
import { type Option, Schema } from "effect";

/** A prompt Nina is admitting for the learner, shown before its chat exists. */
const AiAskSchema = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
});

type AiAsk = typeof AiAskSchema.Type;

/** The two states of an upload that a chip shows: on its way, or failed. */
const AiUploadSchema = Schema.Literals(["uploading", "error"]);

/** The upload that holds one chosen file on the server. */
const AiUploadIdSchema = Id("ninaUploads");

const AiStateSchema = Schema.Struct({
  activeChatId: Schema.NullOr(Id("chats")),
  ask: Schema.NullOr(AiAskSchema),
  chatDrafts: Schema.Array(Schema.String),
  contextTitle: Schema.NullOr(Schema.String),
  /**
   * The upload that holds each chosen file on the server, by the id the
   * composer gave the file. It is kept so a second send does not upload the
   * file again, and so the upload goes back when the learner removes the file.
   * The preview address of a file changes when a hidden composer shows again,
   * and its id does not, so the id is the key.
   */
  held: Schema.Record(Schema.String, AiUploadIdSchema),
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
   * The uploads that are on their way or failed, by the id the composer gave
   * the file. A file with neither has no entry. The id is the key for the same
   * reason it is the key of `held`: the preview address of a file changes when
   * a hidden composer shows again, so a state written under the old address
   * would never be read again and no remove could clear it.
   */
  uploads: Schema.Record(Schema.String, AiUploadSchema),
  /** Whether the sheet's body may render ahead of the press that opens it. */
  warmed: Schema.Boolean,
});

export type AiState = typeof AiStateSchema.Type;

interface AiActions {
  addChatDraft: (key: string) => void;
  /** Forgets that this file is uploading or that its upload failed. */
  clearUpload: (fileId: string) => void;
  /** Remembers the upload that now holds this file on the server. */
  keepUpload: (fileId: string, uploadId: typeof AiUploadIdSchema.Type) => void;
  /** Shows this file as uploading, or as an upload that failed. */
  markUpload: (fileId: string, status: typeof AiUploadSchema.Type) => void;
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
  /**
   * Forgets the uploads that hold these files and returns them, so the caller
   * can give them back to the server. A file that holds none returns nothing.
   */
  takeUploads: (
    fileIds: readonly string[]
  ) => readonly (typeof AiUploadIdSchema.Type)[];
  /** The upload that holds this file on the server, once it has uploaded. */
  uploadOf: (fileId: string) => Option.Option<typeof AiUploadIdSchema.Type>;
  warm: () => void;
}

export type AiStore = AiState & AiActions;
