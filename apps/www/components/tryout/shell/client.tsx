"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/sidebar/app-shell";
import { readTryoutAttemptCapability } from "@/components/tryout/route/path";

/** Locks the app shell only for the exact attempt in the current URL. */
export function TryoutShell({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const capability = readTryoutAttemptCapability(searchParams);
  const attemptId =
    capability.kind === "valid" ? capability.attemptId : undefined;
  const shouldLoadAttempt = !isLoading && isAuthenticated && Boolean(attemptId);
  const locked = useQuery(
    api.tryouts.queries.attempt.isLockedByAttemptId,
    shouldLoadAttempt && attemptId ? { attemptId } : "skip"
  );
  if (shouldLoadAttempt && locked === undefined) {
    return null;
  }

  return <AppShell locked={locked ?? false}>{children}</AppShell>;
}
