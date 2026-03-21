"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { Locale } from "next-intl";
import { useTryoutQueryNowMs } from "@/components/tryout/hooks/use-query-now-ms";
import { useUser } from "@/lib/context/use-user";

export interface UserTryoutAttemptParams {
  locale: Locale;
  product: TryoutProduct;
  tryoutSlug: string;
}

/**
 * Loads the current user's latest tryout attempt when auth and route data are ready.
 *
 * Pass `null` to skip the query on routes that are outside the tryout flow.
 */
export function useUserTryoutAttempt(params: UserTryoutAttemptParams | null) {
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const shouldQuery = Boolean(params && !isUserPending && user);
  const nowMs = useTryoutQueryNowMs(shouldQuery);
  const queryArgs: UserTryoutAttemptParams | "skip" =
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
