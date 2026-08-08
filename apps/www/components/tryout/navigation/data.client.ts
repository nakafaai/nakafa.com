"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useConvex, useConvexAuth } from "convex/react";
import type { Locale } from "next-intl";

export type TryoutDataIntent =
  | {
      kind: "set";
      locale: Locale;
      publicPath: string;
    }
  | {
      attemptId?: Id<"tryoutAttempts">;
      kind: "section";
      locale: Locale;
      publicPath: string;
    };

/**
 * Prewarms the exact authenticated Convex queries mounted by a set or section.
 * Convex owns the short subscription lifetime and reuses the result when the
 * destination hook subscribes.
 *
 * @returns An intent callback that reports whether authenticated warming ran.
 */
export function useTryoutDataIntent() {
  const convex = useConvex();
  const { isAuthenticated, isLoading } = useConvexAuth();

  return function prewarmTryoutData(intent: TryoutDataIntent) {
    if (isLoading || !isAuthenticated) {
      return false;
    }

    if (intent.kind === "set") {
      convex.prewarmQuery({
        args: {
          locale: intent.locale,
          publicPath: intent.publicPath,
        },
        query: api.tryouts.queries.runtime.getSetState,
      });
      return true;
    }

    const args = {
      ...(intent.attemptId ? { attemptId: intent.attemptId } : {}),
      locale: intent.locale,
      publicPath: intent.publicPath,
    };

    convex.prewarmQuery({
      args,
      query: api.tryouts.queries.runtime.getSectionState,
    });
    return true;
  };
}
