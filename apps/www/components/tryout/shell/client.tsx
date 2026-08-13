"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { AppShell } from "@/components/sidebar/app-shell";
import { readTryoutAttemptCapability } from "@/components/tryout/route/path";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";

/** Locks the app shell only for the exact attempt in the current URL. */
export function TryoutShell({
  articleNavigation,
  children,
}: {
  articleNavigation: readonly ArticleNavigationItem[];
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const capability = readTryoutAttemptCapability(searchParams);
  const attemptId =
    capability.kind === "valid" ? capability.attemptId : undefined;
  const shouldLoadAttempt = !isLoading && isAuthenticated && Boolean(attemptId);

  if (!(shouldLoadAttempt && attemptId)) {
    return (
      <AppShell articleNavigation={articleNavigation}>{children}</AppShell>
    );
  }

  return (
    <AttemptBoundTryoutShell
      articleNavigation={articleNavigation}
      attemptId={attemptId}
      key={attemptId}
    >
      {children}
    </AttemptBoundTryoutShell>
  );
}

/** Keeps only an active attempt lock subscribed and preserves the shell while loading. */
function AttemptBoundTryoutShell({
  articleNavigation,
  attemptId,
  children,
}: {
  articleNavigation: readonly ArticleNavigationItem[];
  attemptId: string;
  children: ReactNode;
}) {
  const [isTerminal, setIsTerminal] = useState(false);
  const locked = useQuery(
    api.tryouts.queries.attempt.isLockedByAttemptId,
    isTerminal ? "skip" : { attemptId }
  );

  if (!isTerminal && locked === false) {
    setIsTerminal(true);
  }

  return (
    <AppShell
      articleNavigation={articleNavigation}
      locked={isTerminal ? false : (locked ?? true)}
    >
      {children}
    </AppShell>
  );
}
