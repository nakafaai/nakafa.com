"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ReactNode } from "react";
import { createContext, useContextSelector } from "use-context-selector";

type ForumScrollContextValue = {
  scrollToPostId: (postId: Id<"schoolClassForumPosts">) => void;
  jumpToPostId: (postId: Id<"schoolClassForumPosts">) => void;
  scrollToBottom: () => void;
};

const ForumScrollContext = createContext<ForumScrollContextValue | null>(null);

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

export function useForumScroll<T>(
  selector: (state: ForumScrollContextValue) => T
): T {
  const value = useContextSelector(ForumScrollContext, (ctx) => ctx);
  if (!value) {
    throw new Error("useForumScroll must be used within a ForumScrollProvider");
  }
  return selector(value);
}

// Optional: Get the whole context if needed
export function useForumScrollContext() {
  const value = useContextSelector(ForumScrollContext, (ctx) => ctx);
  return value;
}
