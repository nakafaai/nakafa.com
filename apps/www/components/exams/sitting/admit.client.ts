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
import { Clock, Effect, Option, Schema } from "effect";
import { useRef } from "react";
import { serverClockOffset } from "@/components/exams/sitting/clock";
import {
  readSittingDevice,
  rememberSittingDevice,
  reusedDeviceOf,
  type SittingFlight,
} from "@/components/exams/sitting/device";
import {
  EntryMessage,
  entryRefusalMessage,
  sittingFailureMessage,
} from "@/components/exams/sitting/entry";
import { reportClientException } from "@/lib/analytics/client";

/**
 * What one entry with a token comes to: the attempt that admits the student, with the correction of
 * the device's clock, the sentence that explains a refusal, or a failure that the screen reports in
 * general terms.
 */
const Admission = Schema.Union([
  Schema.TaggedStruct("admitted", {
    attemptId: Id("examAttempts"),
    clockOffset: Schema.Finite,
    deviceId: DeviceId,
    state: AttemptState,
  }),
  Schema.TaggedStruct("refused", { message: EntryMessage }),
  Schema.TaggedStruct("failed", {}),
]);
export type Admission = typeof Admission.Type;

/**
 * The device of one entry: the one the browser keeps, else the one that an entry in flight already
 * sent, else a new one. A second press while the first entry is in flight reuses its device, so the
 * server admits both presses to the same attempt.
 */
const deviceFor = Effect.fn("exams.sitting.admit.device")(function* (
  sittingId: GenericId.GenericId<"examSittings">,
  flight: SittingFlight | null
) {
  const reused = reusedDeviceOf(
    yield* readSittingDevice(sittingId),
    flight,
    sittingId
  );
  if (Option.isSome(reused)) {
    return reused.value;
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
  return Option.match(sittingFailureMessage(error), {
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
 * Enters a sitting from this browser and hands the answer to the screen. A device that the browser keeps
 * enters without a token, because it already owns the attempt. A new device is kept by the browser only
 * once the server admits it, so a refused entry leaves no device. The admission carries the correction of
 * the device's clock, read from the round trip of the entry.
 */
export function useEnterSitting() {
  const enter = useMutation(exams.sittings.enter);
  const flight = useRef<SittingFlight | null>(null);

  /** Sends one entry from one device, and hands the outcome to the screen once the server answers. */
  function send(
    input: {
      readonly sittingId: GenericId.GenericId<"examSittings">;
      readonly slug: TenantSlug;
      readonly token: string;
    },
    deviceId: typeof DeviceId.Type,
    onAdmission: (admission: Admission) => void
  ) {
    return Clock.currentTimeMillis.pipe(
      Effect.flatMap((sentAt) =>
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
              return Clock.currentTimeMillis.pipe(
                Effect.flatMap((receivedAt) =>
                  rememberSittingDevice(input.sittingId, deviceId).pipe(
                    Effect.catchTag(
                      "SittingDeviceStorageFailed",
                      () => Effect.void
                    ),
                    Effect.andThen(
                      Effect.sync(() => {
                        onAdmission({
                          _tag: "admitted",
                          attemptId: outcome.attempt,
                          clockOffset: serverClockOffset({
                            receivedAt,
                            sentAt,
                            serverNow: outcome.serverNow,
                          }),
                          deviceId,
                          state: outcome.state,
                        });
                      })
                    )
                  )
                )
              );
            },
          })
        )
      )
    );
  }

  return (
    input: {
      readonly sittingId: GenericId.GenericId<"examSittings">;
      readonly slug: TenantSlug;
      readonly token: string;
    },
    onAdmission: (admission: Admission) => void
  ) =>
    Effect.runPromise(
      deviceFor(input.sittingId, flight.current).pipe(
        Effect.flatMap((deviceId) => {
          flight.current = { deviceId, sittingId: input.sittingId };
          return send(input, deviceId, onAdmission).pipe(
            Effect.ensuring(
              Effect.sync(() => {
                flight.current = null;
              })
            )
          );
        }),
        Effect.orDie
      )
    );
}
