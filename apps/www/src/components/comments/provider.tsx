"use client";

import { DateTime } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import {
  type CommentDraft,
  createCommentDraft,
} from "@/components/comments/draft";
import type { AgeClock } from "@/components/user/clock";
import { useAgeClock, useAgeNow } from "@/components/user/ages";

const ClockContext = createContext<StoreApi<AgeClock> | null>(null);
const DraftContext = createContext<StoreApi<CommentDraft> | null>(null);

/**
 * Gives one list of comments, on a content page or on a profile, the clock its ages
 * count from and the draft of what it is writing. Both are stores created once for
 * the list: a timer moves the clock, and only the list's own actions write the
 * draft, so only the rows that read a changed part render again.
 */
export function CommentsProvider({ children }: { children: ReactNode }) {
  const clock = useAgeClock(DateTime.toEpochMillis(DateTime.nowUnsafe()));
  const [draft] = useState(() => createCommentDraft());

  return (
    <ClockContext value={clock}>
      <DraftContext value={draft}>{children}</DraftContext>
    </ClockContext>
  );
}

/** The moment the ages of the comments count from, which the timer moves forward. */
export function useCommentsNow() {
  const clock = use(ClockContext);

  if (!clock) {
    throw new Error("useCommentsNow must be used within CommentsProvider");
  }

  return useAgeNow(clock);
}

/** Reads one selected part of what the list is writing. */
export function useCommentDraft<T>(selector: (draft: CommentDraft) => T) {
  const store = use(DraftContext);

  if (!store) {
    throw new Error("useCommentDraft must be used within CommentsProvider");
  }

  return useStore(store, selector);
}
