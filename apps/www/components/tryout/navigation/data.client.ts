"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useConvex, useConvexAuth } from "convex/react";
import { useRef } from "react";
import {
  getTryoutDataIntentKey,
  isTryoutQueryLeaseActive,
  TRYOUT_QUERY_LEASE_MS,
  type TryoutDataIntent,
} from "@/components/tryout/navigation/intent";
import { tryoutRuntimeQueryContract } from "@/components/tryout/runtime/types";

/**
 * Prewarms the exact authenticated Convex queries mounted by a set or section.
 * Convex owns the short subscription lifetime and reuses the result when the
 * destination hook subscribes. Try-out navigation owns the five-second lease.
 * @see https://docs.convex.dev/api/classes/react.ConvexReactClient#prewarmquery
 */
export function useTryoutDataIntent() {
  const convex = useConvex();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const leaseExpirations = useRef(new Map<string, number>());

  return function prewarmTryoutData(intent: TryoutDataIntent) {
    if (isLoading || !isAuthenticated) {
      return;
    }

    const now = Date.now();
    for (const [leaseKey, expiresAt] of leaseExpirations.current) {
      if (!isTryoutQueryLeaseActive(expiresAt, now)) {
        leaseExpirations.current.delete(leaseKey);
      }
    }

    const intentKey = getTryoutDataIntentKey(intent);
    if (
      isTryoutQueryLeaseActive(leaseExpirations.current.get(intentKey), now)
    ) {
      return;
    }

    if (intent.kind === "set") {
      convex.prewarmQuery({
        args: {
          attemptId: intent.attemptId,
          ...tryoutRuntimeQueryContract,
        },
        extendSubscriptionFor: TRYOUT_QUERY_LEASE_MS,
        query: api.tryouts.queries.runtime.getSetAttemptState,
      });
    } else {
      convex.prewarmQuery({
        args: {
          attemptId: intent.attemptId,
          ...tryoutRuntimeQueryContract,
          sectionKey: intent.sectionKey,
        },
        extendSubscriptionFor: TRYOUT_QUERY_LEASE_MS,
        query: api.tryouts.queries.runtime.getSectionAttemptState,
      });
    }

    leaseExpirations.current.set(intentKey, now + TRYOUT_QUERY_LEASE_MS);
  };
}
