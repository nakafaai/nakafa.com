"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { FunctionArgs } from "convex/server";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import { useUser } from "@/lib/context/use-user";

type TryoutAttemptQueryArgs = FunctionArgs<
  typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt
>;
export type TryoutAttemptParams = TryoutAttemptQueryArgs;

/** Loads the current user's latest tryout attempt together with a shared clock. */
export function useTryoutAttempt(params: TryoutAttemptParams | null) {
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const shouldQuery = Boolean(params && !isUserPending && user);
  const queryArgs: TryoutAttemptQueryArgs | "skip" =
    shouldQuery && params ? params : "skip";
  const queryResult = useQueryWithStatus(
    api.tryouts.queries.me.attempt.getUserTryoutAttempt,
    queryArgs
  );
  const nowMs = useTryoutClock(
    Boolean(
      queryResult.data && queryResult.data.attempt.status === "in-progress"
    )
  );

  return {
    nowMs,
    ...queryResult,
  };
}
