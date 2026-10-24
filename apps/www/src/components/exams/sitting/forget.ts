import type { GenericId } from "@confect/core";
import type { StudentSittingRow } from "@repo/backend/confect/exams/sittings/contract";
import { Array as Arr, Effect } from "effect";
import {
  forgetAttempt,
  submittedKeysOf,
} from "@/components/exams/sitting/keep";
import { sittingStorage } from "@/components/exams/sitting/storage";
import { reportClientException } from "@/lib/analytics/client";

/** Drops what the browser keeps for a submitted attempt. A browser that refuses storage reports it. */
export function forgetKeptAttempt(
  sittingId: GenericId.GenericId<"examSittings">,
  attemptId: GenericId.GenericId<"examAttempts">
) {
  Effect.runSync(
    forgetAttempt(sittingId, attemptId).pipe(
      Effect.provide(sittingStorage),
      Effect.catchTag("KeyValueStoreError", (error) =>
        reportClientException(error, {
          source: "components/exams/sitting/kept",
        })
      )
    )
  );
}

/**
 * Drops what the browser keeps for each attempt that the student's list shows as submitted. The list comes
 * from the server, and no optimistic change reaches it, so the kept state of an attempt that is still open is
 * never dropped here. This module holds no sender, so the student's home loads only the forgetting.
 */
export function forgetSubmittedKept(
  rows: readonly (typeof StudentSittingRow.Type)[]
) {
  Arr.forEach(submittedKeysOf(rows), ({ attemptId, sittingId }) =>
    forgetKeptAttempt(sittingId, attemptId)
  );
}
