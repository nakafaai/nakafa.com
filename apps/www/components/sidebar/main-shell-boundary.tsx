"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/sidebar/app-shell";

/** Removes route groups from the selected layout segments. */
function getContentSegments(segments: string[]) {
  return segments.filter((segment) => !segment.startsWith("("));
}

/** Returns whether the current `(main)` child route is a focused tryout page. */
function isFocusedTryoutRoute(segments: string[]) {
  if (segments[0] !== "try-out") {
    return false;
  }

  if (segments.length === 3) {
    return true;
  }

  return segments.length === 5 && segments[3] === "part";
}

/** Chooses the default app shell only for routes that do not own tryout shell state. */
export function MainShellBoundary({ children }: { children: ReactNode }) {
  const segments = useSelectedLayoutSegments();
  const contentSegments = getContentSegments(segments);

  if (isFocusedTryoutRoute(contentSegments)) {
    return children;
  }

  return <AppShell>{children}</AppShell>;
}
