"use client";

import { type ReactNode, useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  createSessionStore,
  type SessionStore,
} from "@/components/school/classes/forum/conversation/store/session";

type SessionStoreApi = ReturnType<typeof createSessionStore>;

const SessionContext = createContext<SessionStoreApi | null>(null);

/** Provides one class-scoped session store instance. */
export function SessionProvider({ children }: { children?: ReactNode }) {
  const store = useMemo(() => createSessionStore(), []);

  return (
    <SessionContext.Provider value={store}>{children}</SessionContext.Provider>
  );
}

/** Reads one selected slice from the session store. */
export function useSession<T>(selector: (state: SessionStore) => T): T {
  const store = useContextSelector(SessionContext, (value) => value);

  if (!store) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return useStore(store, useShallow(selector));
}
