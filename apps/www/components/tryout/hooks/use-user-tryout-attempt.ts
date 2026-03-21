"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useTryoutQueryNowMs } from "@/components/tryout/hooks/use-query-now-ms";
import type { TryoutAttemptParams } from "@/components/tryout/utils/attempt-params";
import { useUser } from "@/lib/context/use-user";

/**
 * Loads the current user's latest tryout attempt when auth and route data are ready.
 *
 * Pass `null` to skip the query on routes that are outside the tryout flow.
 */
export function useUserTryoutAttempt(params: TryoutAttemptParams | null) {
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const shouldQuery = Boolean(params && !isUserPending && user);
  const nowMs = useTryoutQueryNowMs(shouldQuery);
  const queryArgs: TryoutAttemptParams | "skip" =
    shouldQuery && params ? params : "skip";
  const queryResult = useQueryWithStatus(
    api.tryouts.queries.attempts.getUserTryoutAttempt,
    queryArgs
  );

  return {
    nowMs,
    ...queryResult,
  };
}
