import type { MessageDoc } from "@convex-dev/agent/validators";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  identityOf,
  isSealed,
  openMessage,
} from "@repo/backend/confect/nina/sealed";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import { Array as Arr, Effect } from "effect";

type LearnerId = Docs["users"]["_id"];

/**
 * Opens the rows of one read for the learner who owns their thread, and returns
 * them in the same order. A read of plain rows reads no key and returns them as
 * they are. A read with a sealed row reads the owner's key once, for the whole
 * read, and opens each row under its own place (ADR 0024).
 */
export const openRows = Effect.fn("nina.sealed.rows")(function* (
  owner: LearnerId,
  rows: MessageDoc[]
) {
  if (!Arr.some(rows, isSealed)) {
    return rows;
  }
  const keys = yield* readLearnerKeys(owner);
  return yield* Effect.forEach(rows, (row) =>
    openMessage(keys, identityOf(row), row)
  );
});
