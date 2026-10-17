"use client";

import { createContext, type ReactNode, use, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import { createReplying, type Replying } from "@/components/comments/replying";
import type { AgeClock } from "@/components/user/clock";

const CommentsContext = createContext<{
  /** The clock that the ages of the comments count from. */
  readonly clock: StoreApi<AgeClock>;
  /** The slug whose comments the list shows. */
  readonly slug: string;
} | null>(null);
const ReplyingContext = createContext<StoreApi<Replying> | null>(null);

/**
 * Gives the list and its threads the slug and the clock, which are render values.
 * The reply composer that is open lives in a store that this provider creates once
 * for the list, and only the list's own actions write it.
 */
export function CommentsProvider({
  children,
  clock,
  slug,
}: {
  readonly children: ReactNode;
  /** The clock that the ages of the comments count from. */
  readonly clock: StoreApi<AgeClock>;
  /** The slug whose comments the list shows. */
  readonly slug: string;
}) {
  const [replying] = useState(() => createReplying());

  return (
    <ReplyingContext value={replying}>
      <CommentsContext value={{ clock, slug }}>{children}</CommentsContext>
    </ReplyingContext>
  );
}

/** Reads the slug and the clock that the list gives its comments. */
export function useCommentsContext() {
  const value = use(CommentsContext);

  if (!value) {
    throw new Error("useCommentsContext must be used within CommentsProvider");
  }

  return value;
}

/** Reads one selected part of the reply composer that is open in the list. */
export function useReplying<T>(selector: (replying: Replying) => T) {
  const store = use(ReplyingContext);

  if (!store) {
    throw new Error("useReplying must be used within CommentsProvider");
  }

  return useStore(store, selector);
}
