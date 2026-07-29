"use client";

import { Data, Effect } from "effect";

const AI_DRAFT_STORAGE_KEY = "nakafa-ai-draft";

/** Describes an unavailable or rejected Nina draft storage operation. */
class AiDraftStorageError extends Data.TaggedError("AiDraftStorageError")<{
  cause: unknown;
}> {}

/** Saves or clears the current Nina draft without interrupting the input. */
export function saveAiDraftText(text: string) {
  return Effect.try({
    catch: (cause) => new AiDraftStorageError({ cause }),
    try: () => {
      if (typeof window === "undefined") {
        return;
      }

      if (text.length === 0) {
        window.sessionStorage.removeItem(AI_DRAFT_STORAGE_KEY);
        return;
      }

      window.sessionStorage.setItem(AI_DRAFT_STORAGE_KEY, text);
    },
  }).pipe(Effect.catchTag("AiDraftStorageError", () => Effect.void));
}

/** Reads the current Nina draft and treats unavailable storage as empty. */
export function readAiDraftText() {
  return Effect.try({
    catch: (cause) => new AiDraftStorageError({ cause }),
    try: () => {
      if (typeof window === "undefined") {
        return null;
      }

      return window.sessionStorage.getItem(AI_DRAFT_STORAGE_KEY);
    },
  }).pipe(
    Effect.catchTag("AiDraftStorageError", () =>
      Effect.succeed<string | null>(null)
    )
  );
}

/** Clears the current tab's Nina draft without interrupting sign-out. */
export const clearAiDraftText = saveAiDraftText("");
