"use client";

import { Data, Effect, Option, Schema } from "effect";

const AI_DRAFT_STORAGE_KEY = "nakafa-ai-draft";
const ANONYMOUS_DRAFT_OWNER = "anonymous";

const AiDraftRecordSchema = Schema.Struct({
  owner: Schema.String,
  text: Schema.String,
});

interface AiDraftResolution {
  ownerId: string | null;
  pendingText: string;
  pendingTextChanged: boolean;
}

/** Describes an unavailable or rejected Nina draft storage operation. */
class AiDraftStorageError extends Data.TaggedError("AiDraftStorageError")<{
  cause: unknown;
}> {}

/** Encodes a resolved account identity for tab-scoped draft ownership. */
function encodeDraftOwner(ownerId: string | null) {
  return ownerId ?? ANONYMOUS_DRAFT_OWNER;
}

/** Removes every tab-scoped value owned by the Nina draft handoff. */
function removeAiDraft() {
  window.sessionStorage.removeItem(AI_DRAFT_STORAGE_KEY);
}

/** Saves or clears the current Nina draft without interrupting the input. */
export function saveAiDraftText(
  text: string,
  ownerId: string | null | undefined
) {
  return Effect.try({
    catch: (cause) => new AiDraftStorageError({ cause }),
    try: () => {
      if (typeof window === "undefined" || ownerId === undefined) {
        return;
      }

      if (text.length === 0) {
        removeAiDraft();
        return;
      }

      window.sessionStorage.setItem(
        AI_DRAFT_STORAGE_KEY,
        JSON.stringify({
          owner: encodeDraftOwner(ownerId),
          text,
        })
      );
    },
  }).pipe(Effect.catchTag("AiDraftStorageError", () => Effect.void));
}

/**
 * Reads a draft owned by the current account and claims anonymous auth handoffs.
 */
export function readAiDraftText(ownerId: string | null) {
  return Effect.try({
    catch: (cause) => new AiDraftStorageError({ cause }),
    try: () => {
      if (typeof window === "undefined") {
        return null;
      }

      const storedDraft = window.sessionStorage.getItem(AI_DRAFT_STORAGE_KEY);
      if (!storedDraft) {
        return null;
      }

      const decodedDraft = Schema.decodeUnknownOption(
        Schema.parseJson(AiDraftRecordSchema)
      )(storedDraft);
      if (Option.isNone(decodedDraft)) {
        removeAiDraft();
        return null;
      }

      const draft = decodedDraft.value;
      const currentOwner = encodeDraftOwner(ownerId);
      if (
        draft.owner === ANONYMOUS_DRAFT_OWNER &&
        currentOwner !== ANONYMOUS_DRAFT_OWNER
      ) {
        window.sessionStorage.setItem(
          AI_DRAFT_STORAGE_KEY,
          JSON.stringify({
            owner: currentOwner,
            text: draft.text,
          })
        );
        return draft.text;
      }
      if (draft.owner === currentOwner) {
        return draft.text;
      }

      removeAiDraft();
      return null;
    },
  }).pipe(
    Effect.catchTag("AiDraftStorageError", () =>
      Effect.succeed<string | null>(null)
    )
  );
}

/**
 * Keeps text entered during session resolution ahead of an older saved draft.
 */
export function resolveAiDraftText({
  ownerId,
  pendingText,
  pendingTextChanged,
}: AiDraftResolution) {
  if (pendingTextChanged) {
    return saveAiDraftText(pendingText, ownerId).pipe(
      Effect.as<string | null>(pendingText)
    );
  }

  return readAiDraftText(ownerId);
}

/** Clears the current tab's Nina draft without interrupting sign-out. */
export const clearAiDraftText = saveAiDraftText("", null);
