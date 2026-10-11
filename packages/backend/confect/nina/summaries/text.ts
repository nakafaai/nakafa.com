import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  ensureLearnerKeys,
  readLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Effect, Predicate } from "effect";

type Summary = Docs["ninaSummaries"];
type UserId = Docs["users"]["_id"];

/** The stored field a summary text is sealed for, besides the chat owner. */
export const SUMMARY_TEXT = { field: "text", table: "ninaSummaries" } as const;

/**
 * Seals a summary text for the learner who owns the chat. The first seal of a
 * learner creates their key. A vault failure is a deployment defect, so it
 * dies instead of reaching the caller.
 */
export const sealSummary = Effect.fn("nina.summaries.text.seal")(function* (
  userId: UserId,
  text: string
) {
  return yield* sealText(yield* ensureLearnerKeys(userId), SUMMARY_TEXT, text);
}, Effect.orDie);

/**
 * Opens a stored summary text for the learner who owns the chat. A plain text,
 * written before October 2026, comes back as it is and needs no key. A sealed
 * text opens with the owner's keys.
 */
export const openSummary = Effect.fn("nina.summaries.text.open")(function* (
  userId: UserId,
  stored: Summary["text"]
) {
  if (Predicate.isString(stored)) {
    return stored;
  }
  return yield* openText(yield* readLearnerKeys(userId), SUMMARY_TEXT, stored);
}, Effect.orDie);
