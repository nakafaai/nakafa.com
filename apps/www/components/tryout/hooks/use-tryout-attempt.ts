"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { FunctionArgs } from "convex/server";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import { useUser } from "@/lib/context/use-user";

type TryoutAttemptQueryArgs = FunctionArgs<
  typeof api.tryouts.queries.attempts.getUserTryoutAttempt
>;
export type TryoutAttemptParams = Omit<TryoutAttemptQueryArgs, "nowMs">;

/** Loads the current user's latest tryout attempt together with a shared clock. */
export function useTryoutAttempt(params: TryoutAttemptParams | null) {
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const shouldQuery = Boolean(params && !isUserPending && user);
  const nowMs = useTryoutClock(shouldQuery);
  const queryArgs: TryoutAttemptQueryArgs | "skip" =
    shouldQuery && params ? { ...params, nowMs } : "skip";
  const queryResult = useQueryWithStatus(
    api.tryouts.queries.attempts.getUserTryoutAttempt,
    queryArgs
  );

  return {
    nowMs,
    ...queryResult,
  };
}
