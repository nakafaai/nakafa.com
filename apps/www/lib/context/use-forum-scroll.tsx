"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ReactNode } from "react";
import { createContext, useContextSelector } from "use-context-selector";

interface ForumScrollContextValue {
  jumpToPostId: (postId: Id<"schoolClassForumPosts">) => void;
  scrollToLatest: () => void;
  scrollToPostId: (postId: Id<"schoolClassForumPosts">) => void;
}

const ForumScrollContext = createContext<ForumScrollContextValue | null>(null);
const MISSING_FORUM_SCROLL_CONTEXT = Symbol("MISSING_FORUM_SCROLL_CONTEXT");

/** Provides scroll actions for the active forum conversation subtree. */
export function ForumScrollProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: ForumScrollContextValue;
}) {
  return (
    <ForumScrollContext.Provider value={value}>
      {children}
    </ForumScrollContext.Provider>
  );
}

/** Reads one selected scroll action from the active forum conversation. */
export function useForumScroll<T>(
  selector: (state: ForumScrollContextValue) => T
): T {
  const value = useContextSelector(
    ForumScrollContext,
    (ctx): T | typeof MISSING_FORUM_SCROLL_CONTEXT =>
      ctx ? selector(ctx) : MISSING_FORUM_SCROLL_CONTEXT
  );

  if (value === MISSING_FORUM_SCROLL_CONTEXT) {
    throw new Error("useForumScroll must be used within a ForumScrollProvider");
  }

  return value;
}
