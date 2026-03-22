"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { FunctionArgs } from "convex/server";
import { useTryoutQueryNowMs } from "@/components/tryout/hooks/use-tryout-clock";
import { useUser } from "@/lib/context/use-user";

export type TryoutAttemptParams = FunctionArgs<
  typeof api.tryouts.queries.attempts.getUserTryoutAttempt
>;

/** Loads the current user's latest tryout attempt together with a shared clock. */
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
