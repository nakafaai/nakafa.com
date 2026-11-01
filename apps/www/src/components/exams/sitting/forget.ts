import type { GenericId } from "@confect/core";
import type { StudentSittingRow } from "@repo/backend/confect/exams/sittings/contract";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Record as Rec } from "effect";
import { forgetSittingDevice } from "@/components/exams/sitting/device";
import {
  keptAttempt,
  keptFinish,
  submittedKeysOf,
} from "@/components/exams/sitting/keep";
import { keptStorage } from "@/components/player/storage";
import { reportClientException } from "@/lib/analytics/client";

/** Tells a student that a closed attempt left answers on this device that the server may not hold. */
export function toastUnsentAnswers() {
  toast.error({
    description: "sitting-answers-unsent.description",
    title: "sitting-answers-unsent.title",
  });
}

/** Whether the browser still holds an unconfirmed answer of an attempt. A browser that refuses storage holds none. */
function holdsAnswers(
  sittingId: GenericId.GenericId<"examSittings">,
  attemptId: GenericId.GenericId<"examAttempts">
) {
  return Effect.runSync(
    keptAttempt(sittingId, attemptId)
      .read()
      .pipe(
        Effect.map(({ answers }) => !Rec.isEmptyReadonlyRecord(answers)),
        Effect.provide(keptStorage),
        Effect.catchTag("KeyValueStoreError", () => Effect.succeed(false))
      )
  );
}

/** Drops what the browser keeps for a submitted attempt, its device included. A browser that refuses storage reports it. */
export function forgetKeptAttempt(
  sittingId: GenericId.GenericId<"examSittings">,
  attemptId: GenericId.GenericId<"examAttempts">
) {
  Effect.runSync(
    keptAttempt(sittingId, attemptId)
      .forget()
      .pipe(
        Effect.andThen(keptFinish(sittingId, attemptId).drop()),
        Effect.provide(keptStorage),
        Effect.catchTag("KeyValueStoreError", (error) =>
          reportClientException(error, {
            source: "components/exams/sitting/kept",
          })
        ),
        Effect.andThen(forgetSittingDevice(sittingId)),
        Effect.catchTag("SittingDeviceStorageFailed", () => Effect.void)
      )
  );
}

/**
 * Drops what the browser keeps for each attempt that the student's list shows as submitted. The list comes
 * from the server, and no optimistic change reaches it, so the kept state of an attempt that is still open is
 * never dropped here. An answer still kept by then never reached the student's sitting page, so the student is
 * told before it goes, once for all of them.
 */
export function forgetSubmittedKept(
  rows: readonly (typeof StudentSittingRow.Type)[]
) {
  const keys = submittedKeysOf(rows);
  const unsent = Arr.some(keys, ({ attemptId, sittingId }) =>
    holdsAnswers(sittingId, attemptId)
  );
  Arr.forEach(keys, ({ attemptId, sittingId }) =>
    forgetKeptAttempt(sittingId, attemptId)
  );
  if (unsent) {
    toastUnsentAnswers();
  }
}
