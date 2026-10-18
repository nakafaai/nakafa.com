"use client";

import type { GenericId } from "@confect/core";
import { useMutation } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  AttemptState,
  DeviceId,
} from "@repo/backend/confect/exams/sittings/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { toast } from "@repo/design-system/lib/toast/notify";
import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Option, Schema } from "effect";
import {
  readSittingDevice,
  rememberSittingDevice,
} from "@/components/exams/sitting/device";
import {
  EntryMessage,
  entryFailureMessage,
  entryRefusalMessage,
} from "@/components/exams/sitting/entry";
import { reportClientException } from "@/lib/analytics/client";

/**
 * What one entry with a token comes to: the attempt that admits the student, the sentence that
 * explains a refusal, or a failure that the screen reports in general terms.
 */
const Admission = Schema.Union([
  Schema.TaggedStruct("admitted", {
    attemptId: Id("examAttempts"),
    deviceId: DeviceId,
    state: AttemptState,
  }),
  Schema.TaggedStruct("refused", { message: EntryMessage }),
  Schema.TaggedStruct("failed", {}),
]);
export type Admission = typeof Admission.Type;

/** The device of the browser for one sitting: the one it keeps, or a new one. */
const deviceFor = Effect.fn("exams.sitting.admit.device")(function* (
  sittingId: GenericId.GenericId<"examSittings">
) {
  const stored = yield* readSittingDevice(sittingId);
  if (Option.isSome(stored)) {
    return stored.value;
  }
  const uuid = yield* randomUuid;
  return yield* Schema.decodeEffect(DeviceId)(uuid).pipe(Effect.orDie);
});

/**
 * Hands the screen the answer to a failed entry: the sentence that names the reason when the
 * server names one, or else the generic failure, which is also reported.
 */
function failureOf(
  error: unknown,
  onAdmission: (admission: Admission) => void
) {
  return Option.match(entryFailureMessage(error), {
    onNone: () =>
      reportClientException(error, {
        source: "components/exams/sitting/admit",
      }).pipe(
        Effect.andThen(
          Effect.sync(() => {
            toast.error({
              description: "action-error.description",
              title: "action-error.title",
            });
            onAdmission({ _tag: "failed" });
          })
        )
      ),
    onSome: (message) =>
      Effect.sync(() => {
        onAdmission({ _tag: "refused", message });
      }),
  });
}

/**
 * Enters a sitting from this browser and hands the answer to the screen. A device that the
 * browser keeps enters without a token, because it already owns the attempt. A new device is
 * kept by the browser only once the server admits it, so a refused entry leaves no device.
 */
export function useEnterSitting() {
  const enter = useMutation(exams.sittings.enter);

  return (
    input: {
      readonly sittingId: GenericId.GenericId<"examSittings">;
      readonly slug: TenantSlug;
      readonly token: string;
    },
    onAdmission: (admission: Admission) => void
  ) =>
    Effect.runPromise(
      deviceFor(input.sittingId).pipe(
        Effect.flatMap((deviceId) =>
          Effect.tryPromise(() =>
            enter({
              deviceId,
              sittingId: input.sittingId,
              slug: input.slug,
              token: input.token,
            })
          ).pipe(
            Effect.flatMap(Effect.fromResult),
            Effect.matchEffect({
              onFailure: (error) => failureOf(error, onAdmission),
              onSuccess: (outcome) => {
                if (outcome.outcome === "refused") {
                  return Effect.sync(() => {
                    onAdmission({
                      _tag: "refused",
                      message: entryRefusalMessage(outcome.reason),
                    });
                  });
                }
                return rememberSittingDevice(input.sittingId, deviceId).pipe(
                  Effect.catchTag(
                    "SittingDeviceStorageFailed",
                    () => Effect.void
                  ),
                  Effect.andThen(
                    Effect.sync(() => {
                      onAdmission({
                        _tag: "admitted",
                        attemptId: outcome.attempt,
                        deviceId,
                        state: outcome.state,
                      });
                    })
                  )
                );
              },
            })
          )
        ),
        Effect.orDie
      )
    );
}
