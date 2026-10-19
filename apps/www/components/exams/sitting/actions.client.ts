"use client";

import { type OptimisticLocalStore, useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Clock, Effect, Option, type Result } from "effect";
import {
  addMinutesToAttempt,
  closeSitting,
  type DashboardValue,
  lockAttempt,
  unlockAttempt,
} from "@/components/exams/sitting/change";
import { reportClientException } from "@/lib/analytics/client";

/** The milliseconds on the device clock, for the optimistic guess that the server settles. */
function nowMillis() {
  return Effect.runSync(Clock.currentTimeMillis);
}

/**
 * Applies one change to every loaded dashboard page of a sitting in the local store, since
 * the attempt it changes sits on one of them and every page carries the sitting. The sitting
 * and the school name the pages, which every proctor action carries. The server's answer
 * replaces the guess, and a refused action rolls it back.
 */
function changeDashboard(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  key: {
    readonly sittingId: DashboardValue["sitting"]["id"];
    readonly slug: TenantSlug;
  },
  change: (value: DashboardValue) => DashboardValue
) {
  for (const { args, value } of localStore.getAllQueries(
    exams.sittings.dashboard
  )) {
    if (
      args.sittingId === key.sittingId &&
      args.slug === key.slug &&
      Option.isSome(value)
    ) {
      localStore.setQuery(
        exams.sittings.dashboard,
        args,
        Option.some(change(value.value))
      );
    }
  }
}

/** Locks an attempt at once, with a reason. */
export function useLockAttempt() {
  return useMutation(exams.sittings.lock).withOptimisticUpdate(
    (localStore, args) =>
      changeDashboard(localStore, args, (value) =>
        lockAttempt(value, args.attemptId)
      )
  );
}

/** Unlocks an attempt at once, with a reason. */
export function useUnlockAttempt() {
  return useMutation(exams.sittings.unlock).withOptimisticUpdate(
    (localStore, args) =>
      changeDashboard(localStore, args, (value) =>
        unlockAttempt(value, args.attemptId, nowMillis())
      )
  );
}

/** Adds minutes to an attempt at once, with a reason. */
export function useAddMinutes() {
  return useMutation(exams.sittings.addMinutes).withOptimisticUpdate(
    (localStore, args) =>
      changeDashboard(localStore, args, (value) =>
        addMinutesToAttempt(value, args.attemptId, args.minutes, nowMillis())
      )
  );
}

/** Closes the sitting at once. Its attempts close at their deadlines, as the server closes them. */
export function useCloseSitting() {
  return useMutation(exams.sittings.close).withOptimisticUpdate(
    (localStore, args) => changeDashboard(localStore, args, closeSitting)
  );
}

/** Allows a second device. The dashboard shows no device, so nothing changes until the server answers. */
export function useAllowDevice() {
  return useMutation(exams.sittings.allowDevice);
}

/** Changes the token. The new token is known only from the server's answer. */
export function useChangeToken() {
  return useMutation(exams.sittings.changeToken);
}

/**
 * Runs one server call from a control. A refused call reports the failure and shows the
 * generic message, and the optimistic change of the call rolls back with it.
 */
export function runSittingCall<A, E>(
  call: () => Promise<Result.Result<A, E>>,
  onSuccess: (value: A) => void = () => undefined
) {
  return Effect.runPromise(
    Effect.tryPromise(call).pipe(
      Effect.flatMap(Effect.fromResult),
      Effect.matchEffect({
        onFailure: (error) =>
          reportClientException(error, {
            source: "components/exams/sitting/actions",
          }).pipe(
            Effect.andThen(
              Effect.sync(() => {
                toast.error({
                  description: "action-error.description",
                  title: "action-error.title",
                });
              })
            )
          ),
        onSuccess: (value) =>
          Effect.sync(() => {
            onSuccess(value);
          }),
      })
    )
  );
}
