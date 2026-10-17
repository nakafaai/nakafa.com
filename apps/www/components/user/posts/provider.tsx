"use client";

import { createContext, type ReactNode, use, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/** The words an author writes in the composer, and how to change them. */
interface PostDraft {
  readonly setText: (text: string) => void;
  readonly text: string;
}

const DraftContext = createContext<StoreApi<PostDraft> | null>(null);

/**
 * Keeps the words an author writes in the composer above the list, so a Retry,
 * which remounts the list, keeps them. The store is created once for the
 * provider, and only the composer writes it, as ADR 0017 asks for state that
 * its own actions write.
 */
export function PostDraftProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() =>
    createStore<PostDraft>()((set) => ({
      setText: (text) => set({ text }),
      text: "",
    }))
  );

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
