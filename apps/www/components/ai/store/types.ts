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

/**
 * An upload that holds a file, and the moment the server drops it if no
 * message has taken it by then.
 */
const AiHoldSchema = Schema.Struct({
  expiresAt: Schema.Finite,
  uploadId: AiUploadIdSchema,
});

const AiStateSchema = Schema.Struct({
  activeChatId: Schema.NullOr(Id("chats")),
  ask: Schema.NullOr(AiAskSchema),
  chatDrafts: Schema.Array(Schema.String),
  /**
   * The key of the composers. A composer keeps the files the learner picked in
   * its own state, and a new key is how React starts that state over. It
   * changes together with the text of the draft, when the draft stops
   * belonging to the learner who started it.
   */
  composerKey: Schema.Int,
  contextTitle: Schema.NullOr(Schema.String),
  /**
   * The upload that holds each chosen file on the server, by the id the
   * composer gave the file. It is kept so a second send does not upload the
   * file again, and so the upload goes back when the learner removes the file.
   * The preview address of a file changes when a hidden composer shows again,
   * and its id does not, so the id is the key.
   */
  held: Schema.Record(Schema.String, AiHoldSchema),
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
  /**
   * Ends the session of the learner the store held things for: the pending
   * ask, the chats that learner was starting or had open, and the uploads it
   * kept and showed. The draft is not part of it, because a visitor who signs
   * in keeps the draft, and the caller decides that. The uploads stay on the
   * server until they expire: the next learner cannot give them back, and the
   * server would refuse.
   */
  endSession: () => void;
  /**
   * Forgets the holds of these uploads, wherever they are held. A hold is found
   * by its upload, not by its file, so a file that got a new hold meanwhile
   * keeps it. Nothing changes when none of the uploads is held.
   */
  forgetUploads: (uploadIds: readonly (typeof AiUploadIdSchema.Type)[]) => void;
  /**
   * Remembers the upload that now holds this file on the server, with the
   * moment the upload began. The server drops it a lifetime after that if no
   * message has taken it.
   */
  keepUpload: (
    fileId: string,
    uploadId: typeof AiUploadIdSchema.Type,
    startedAt: number
  ) => void;
  /** Shows this file as uploading, or as an upload that failed. */
  markUpload: (fileId: string, status: typeof AiUploadSchema.Type) => void;
  openAsk: (ask: AiAsk) => boolean;
  /**
   * The uploads that hold these files on the server, in the order of the files.
   * A file that holds none adds nothing. Nothing changes: the caller gives the
   * uploads back, then forgets the ones the server gave back.
   */
  readUploads: (
    fileIds: readonly string[]
  ) => readonly (typeof AiUploadIdSchema.Type)[];
  removeChatDraft: (key: string) => void;
  /** Starts every composer over, without the files it holds. */
  resetComposers: () => void;
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
   * The files outside a send whose uploads the send has to give back, when the
   * send needs more places than the server leaves beside them. The server
   * counts every upload it has not dropped, whichever composer holds its file.
   * A composer that is gone takes its files with it, and the places held for
   * them stay counted until the server drops them. Nothing is changed: the
   * caller reads their uploads with `readUploads`, gives them back, and forgets
   * the ones given back with `forgetUploads`.
   */
  strayFiles: (fileIds: readonly string[], now: number) => readonly string[];
  /**
   * The upload that holds this file on the server, once it has uploaded and
   * while the server still keeps it at `now`.
   */
  uploadOf: (
    fileId: string,
    now: number
  ) => Option.Option<typeof AiUploadIdSchema.Type>;
  warm: () => void;
}

export type AiStore = AiState & AiActions;
