"use client";

import { createContext, type ReactNode, use, useMemo, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import type { AgeClock } from "@/components/user/clock";
import { useAgeNow } from "@/components/user/clock.client";
import { createPostDraft, type PostDraft } from "@/components/user/posts/draft";
import type { PublicProfile } from "@/lib/profile/public";

const DraftContext = createContext<StoreApi<PostDraft> | null>(null);

/**
 * Keeps the words an author writes in the composer above the list, so a Retry,
 * which remounts the list, keeps them, and keeps the posts that are still
 * saving. The store is created once for the provider, and only the
 * composer's own actions write it, as ADR 0017 asks for state that its own
 * actions write.
 */
export function PostDraftProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createPostDraft());

  return <DraftContext value={store}>{children}</DraftContext>;
}

/** Reads one selected part of the words the composer holds. */
export function usePostDraft<T>(selector: (draft: PostDraft) => T) {
  const store = use(DraftContext);

  if (!store) {
    throw new Error("usePostDraft must be used within PostDraftProvider");
  }

  return useStore(store, selector);
}

/** What the list and its rows show: the profile, whether the viewer owns it, the clock of the ages, and Retry. */
interface PostsValue {
  /** The clock that the ages of the posts count from. */
  readonly clock: StoreApi<AgeClock>;
  /** Whether the signed-in viewer owns the profile, which lets them write and delete its posts. */
  readonly isOwner: boolean;
  /** Asks the server for the list again. */
  readonly onRetry: () => void;
  /** The profile whose posts the list shows. */
  readonly profile: PublicProfile;
}

const PostsContext = createContext<PostsValue | null>(null);

/**
 * Gives the list and its rows what they show. The profile, the owner flag, and
 * Retry are render values, so they travel in this context. The clock is a store
 * that a timer moves, so only the rows that show an age read it on each tick.
 */
export function PostsProvider({
  children,
  clock,
  isOwner,
  onRetry,
  profile,
}: PostsValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ clock, isOwner, onRetry, profile }),
    [clock, isOwner, onRetry, profile]
  );
  return <PostsContext value={value}>{children}</PostsContext>;
}

/** Reads the profile's posts value, which the provider above the list gives. */
export function usePostsContext() {
  const value = use(PostsContext);

  if (!value) {
    throw new Error("usePostsContext must be used within PostsProvider");
  }

  return value;
}

/** The moment the ages of the posts count from, which the timer moves forward. */
export function usePostsNow() {
  const { clock } = usePostsContext();

  return useAgeNow(clock);
}
