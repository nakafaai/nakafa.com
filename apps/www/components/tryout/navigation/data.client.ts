"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useConvex, useConvexAuth } from "convex/react";
import type { Locale } from "next-intl";
import { useCallback } from "react";

export type TryoutDataIntent =
  | {
      directEntry: {
        countryKey: string;
        examKey: string;
        sectionKey: string;
        setKey: string;
        trackKey: string;
      } | null;
      kind: "set";
      locale: Locale;
      publicPath: string;
    }
  | {
      countryKey: string;
      examKey: string;
      kind: "section";
      locale: Locale;
      sectionKey: string;
      setKey: string;
      trackKey: string;
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

  return useCallback(
    (intent: TryoutDataIntent) => {
      if (isLoading || !isAuthenticated) {
        return false;
      }

      if (intent.kind === "set") {
        convex.prewarmQuery({
          args: {
            locale: intent.locale,
            publicPath: intent.publicPath,
          },
          query: api.tryouts.queries.attempt.getCurrentByPublicPath,
        });

        if (intent.directEntry) {
          convex.prewarmQuery({
            args: {
              ...intent.directEntry,
              locale: intent.locale,
            },
            query: api.tryouts.queries.attempt.getSectionRuntime,
          });
        }
        return true;
      }

      const args = {
        countryKey: intent.countryKey,
        examKey: intent.examKey,
        locale: intent.locale,
        sectionKey: intent.sectionKey,
        setKey: intent.setKey,
        trackKey: intent.trackKey,
      };

      convex.prewarmQuery({
        args,
        query: api.tryouts.queries.attempt.getCurrent,
      });
      convex.prewarmQuery({
        args,
        query: api.tryouts.queries.attempt.getSectionRuntime,
      });
      return true;
    },
    [convex, isAuthenticated, isLoading]
  );
}
