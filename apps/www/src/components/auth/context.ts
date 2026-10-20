import { createContext } from "react";
import type { StoreApi } from "zustand";
import type { AuthSession } from "@/lib/auth/session";

/**
 * Carries the one session store of a provider. The context value is the store,
 * which never changes after mount, so readers subscribe with `useStore`.
 */
export const AuthSessionContext = createContext<StoreApi<AuthSession> | null>(
  null
);
