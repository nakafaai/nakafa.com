"use client";

import { createContext, type ReactNode, use, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import { createPostDraft, type PostDraft } from "@/components/user/posts/draft";

const DraftContext = createContext<StoreApi<PostDraft> | null>(null);

/**
 * Keeps the words an author writes in the composer above the list, so a Retry,
 * which remounts the list, keeps them, and keeps the lock of a post that is
 * still saving. The store is created once for the provider, and only the
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
