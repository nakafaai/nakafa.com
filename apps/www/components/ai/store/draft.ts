"use client";
import { encodeJsonText } from "@repo/utilities/json";
import { Data, Effect, Option, Schema } from "effect";

const AI_DRAFT_STORAGE_KEY = "nakafa-ai-draft";
const ANONYMOUS_DRAFT_OWNER = "anonymous";
const AiDraftRecordSchema = Schema.Struct({
  owner: Schema.String,
  text: Schema.String,
});
const AiDraftResolutionSchema = Schema.Struct({
  ownerId: Schema.NullOr(Schema.String),
  pendingText: Schema.String,
  pendingTextChanged: Schema.Boolean,
});
type AiDraftResolution = typeof AiDraftResolutionSchema.Type;
/** Describes an unavailable or rejected Nina draft storage operation. */
class AiDraftStorageError extends Data.TaggedError("AiDraftStorageError")<{
  cause: unknown;
}> {}
/** Encodes a resolved account identity for tab-scoped draft ownership. */
function encodeDraftOwner(ownerId: string | null) {
  return ownerId ?? ANONYMOUS_DRAFT_OWNER;
}
/** Encodes one draft record as the JSON text kept in session storage. */
function encodeAiDraftRecord(owner: string, text: string) {
  return encodeJsonText({ owner, text });
}
/** Removes every tab-scoped value owned by the Nina draft handoff. */
function removeAiDraft() {
  window.sessionStorage.removeItem(AI_DRAFT_STORAGE_KEY);
}
/** Saves or clears the current Nina draft without interrupting the input. */
export const saveAiDraftText = Effect.fn("ai.draft.save")(function* (
  text: string,
  ownerId: string | null | undefined
) {
  yield* Effect.try({
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
        encodeAiDraftRecord(encodeDraftOwner(ownerId), text)
      );
    },
  }).pipe(Effect.catchTag("AiDraftStorageError", () => Effect.void));
});
/**
 * Reads a draft owned by the current account and claims anonymous auth handoffs.
 */
function readAiDraftText(ownerId: string | null) {
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
      const decodedDraft = Schema.decodeOption(
        Schema.fromJsonString(AiDraftRecordSchema)
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
          encodeAiDraftRecord(currentOwner, draft.text)
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
export const resolveAiDraftText = Effect.fn("ai.draft.resolve")(function* ({
  ownerId,
  pendingText,
  pendingTextChanged,
}: AiDraftResolution) {
  if (pendingTextChanged) {
    yield* saveAiDraftText(pendingText, ownerId);
    return pendingText;
  }
  return yield* readAiDraftText(ownerId);
});
/**
 * The composer text once a refused prompt returns to it. The refused words come
 * first and the text the learner typed meanwhile follows them, so a refusal
 * loses neither. With nothing new typed, the refused words are the whole text.
 */
export function restoreRefusedText(refused: string, typed: string) {
  const newer = typed.trim();
  if (newer === "" || newer === refused.trim()) {
    return refused;
  }
  return `${refused}\n\n${typed}`;
}
/** Clears the current tab's Nina draft without interrupting sign-out. */
export const clearAiDraftText = saveAiDraftText("", null);

/**
 * What a change of the signed-in learner does to what Nina holds. The first
 * answer of a page changes nothing. After that, a new learner ends the session
 * of the previous one in the store. The draft, its text and its files, goes
 * too, except when the previous learner was a visitor: a visitor who signs in
 * keeps the draft, because the account takes over what the visitor wrote and
 * attached.
 */
export function resolveAiOwnerChange(
  previousOwnerId: string | null | undefined,
  ownerId: string | null
) {
  const ownerChanged =
    previousOwnerId !== undefined && previousOwnerId !== ownerId;
  return {
    mustResetDraft: ownerChanged && previousOwnerId !== null,
    ownerChanged,
  };
}
