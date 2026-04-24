"use client";

import { type ReactNode, useLayoutEffect, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  createForumSessionStore,
  type ForumSessionStore,
} from "@/components/school/classes/forum/store/session";

type ForumSessionStoreApi = ReturnType<typeof createForumSessionStore>;

const ForumSessionContext = createContext<ForumSessionStoreApi | null>(null);

/** Provides one class-scoped session store instance. */
export function ForumSessionProvider({
  children,
  classId,
}: {
  children: ReactNode;
  classId: string;
}) {
  const [store] = useState(() => createForumSessionStore(classId));

  useLayoutEffect(() => {
    /*
     * The session store opts into manual persist hydration so this provider can
     * finish loading the client-only snapshot before the transcript renders.
     *
     * References:
     * - https://zustand.docs.pmnd.rs/reference/middlewares/persist
     * - https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data
     */
    if (store.persist.hasHydrated()) {
      store.getState().setHydrated(true);
      return;
    }

    const unsubscribe = store.persist.onFinishHydration(() => {
      store.getState().setHydrated(true);
    });

    store.persist.rehydrate();

    return unsubscribe;
  }, [store]);

  return (
    <ForumSessionContext.Provider value={store}>
      {children}
    </ForumSessionContext.Provider>
  );
}

/** Reads one selected slice from the session store. */
export function useForumSession<T>(
  selector: (state: ForumSessionStore) => T
): T {
  const store = useContextSelector(ForumSessionContext, (value) => value);

  if (!store) {
    throw new Error(
      "useForumSession must be used within a ForumSessionProvider"
    );
  }

  return useStore(store, useShallow(selector));
}

/** Reads the raw session store API without subscribing to its state. */
export function useForumSessionStoreApi() {
  const store = useContextSelector(ForumSessionContext, (value) => value);

  if (!store) {
    throw new Error(
      "useForumSessionStoreApi must be used within a ForumSessionProvider"
    );
  }

  return store;
}
