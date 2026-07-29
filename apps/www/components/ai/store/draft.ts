"use client";

import { Data, Effect } from "effect";

const AI_DRAFT_STORAGE_KEY = "nakafa-ai-draft";
const AI_DRAFT_OWNER_STORAGE_KEY = "nakafa-ai-draft-owner";
const ANONYMOUS_DRAFT_OWNER = "anonymous";

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
  window.sessionStorage.removeItem(AI_DRAFT_OWNER_STORAGE_KEY);
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

      window.sessionStorage.setItem(AI_DRAFT_STORAGE_KEY, text);
      window.sessionStorage.setItem(
        AI_DRAFT_OWNER_STORAGE_KEY,
        encodeDraftOwner(ownerId)
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

      const text = window.sessionStorage.getItem(AI_DRAFT_STORAGE_KEY);
      if (!text) {
        return null;
      }

      const storedOwner =
        window.sessionStorage.getItem(AI_DRAFT_OWNER_STORAGE_KEY) ??
        ANONYMOUS_DRAFT_OWNER;
      const currentOwner = encodeDraftOwner(ownerId);
      if (
        storedOwner === ANONYMOUS_DRAFT_OWNER &&
        currentOwner !== ANONYMOUS_DRAFT_OWNER
      ) {
        window.sessionStorage.setItem(AI_DRAFT_OWNER_STORAGE_KEY, currentOwner);
        return text;
      }
      if (storedOwner === currentOwner) {
        return text;
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
export function resolveAiDraftText(
  pendingText: string,
  ownerId: string | null
) {
  if (pendingText.length > 0) {
    return saveAiDraftText(pendingText, ownerId).pipe(
      Effect.as<string | null>(pendingText)
    );
  }

  return readAiDraftText(ownerId);
}

/** Clears the current tab's Nina draft without interrupting sign-out. */
export const clearAiDraftText = saveAiDraftText("", null);
