import { use, useSyncExternalStore } from "react";
import { useAuthSessionStore } from "@/components/auth/session";
import {
  type ConvexAuth,
  ConvexAuthContext,
  readConvexAuth,
} from "@/lib/auth/convex";

/**
 * Selects one part of the Convex authentication state.
 *
 * The state is derived from the session and Convex's latest answer inside one
 * subscription to both stores, so a reader runs only when its selection
 * changes, and the server snapshot is the state the server rendered. The hook
 * lives apart from the provider, so a visitor's page that reads it never loads
 * the Better Auth or Convex client modules.
 */
export function useConvexAuth<T>(selector: (auth: ConvexAuth) => T) {
  const store = use(ConvexAuthContext);
  if (!store) {
    throw new TypeError("useConvexAuth must be used within ConvexProvider");
  }
  const session = useAuthSessionStore();

  return useSyncExternalStore(
    (onChange) => {
      const stopSession = session.subscribe(onChange);
      const stopStore = store.subscribe(onChange);
      return () => {
        stopSession();
        stopStore();
      };
    },
    () =>
      selector(
        readConvexAuth(session.getState(), store.getState().confirmation)
      ),
    () =>
      selector(
        readConvexAuth(
          session.getInitialState(),
          store.getInitialState().confirmation
        )
      )
  );
}
