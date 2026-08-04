import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import type { SyncOptions } from "@repo/backend/scripts/sync-content/contract/types";
import { Effect } from "effect";

/** Rejects locale scoping that could advance shared incremental sync state incompletely. */
export const validateIncrementalSyncOptions = Effect.fn(
  "sync.validateIncrementalOptions"
)(function* (options: SyncOptions) {
  if (!options.locale) {
    return;
  }

  return yield* new ScriptFailureError({
    message:
      "Incremental sync does not support --locale because sync state is shared across locales",
  });
});
