"use client";

import { type ReactNode, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  createForumSessionStore,
  type ForumSessionStore,
} from "@/components/school/classes/forum/conversation/store/session";

type ForumStoreApi = ReturnType<typeof createForumSessionStore>;

export const ForumContext = createContext<ForumStoreApi | null>(null);

/** Provides one class-scoped forum store instance. */
export function ForumContextProvider({
  children,
  classId,
}: {
  children?: ReactNode;
  classId: string;
}) {
  const [store] = useState(() => createForumSessionStore(classId));

  return (
    <ForumContext.Provider value={store}>{children}</ForumContext.Provider>
  );
}

/** Reads the raw forum store API for one class route subtree. */
export function useForumStoreApi() {
  const ctx = useContextSelector(ForumContext, (context) => context);

  if (!ctx) {
    throw new Error(
      "useForumStoreApi must be used within a ForumContextProvider"
    );
  }

  return ctx;
}

/** Reads one selected slice from the forum store. */
export function useForum<T>(selector: (state: ForumSessionStore) => T): T {
  const ctx = useForumStoreApi();
  return useStore(ctx, useShallow(selector));
}
