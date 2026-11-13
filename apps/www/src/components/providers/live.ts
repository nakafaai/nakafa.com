import { useRequired } from "@repo/design-system/hooks/required";
import { createContext } from "react";
import { useStore } from "zustand";
import type { LiveSessionState, LiveSessionStore } from "@/lib/auth/live";

/**
 * Carries the page's one live-session store. The context value is the store, which
 * never changes after mount, so a streamed boundary below it keeps the HTML the
 * server sent. Readers subscribe with `useLiveSession`, and a visitor's page
 * renders its visitor variant until the store holds a Convex client.
 */
export const LiveSessionContext = createContext<LiveSessionStore | null>(null);

/** Returns the live-session store and rejects a missing provider. */
function useLiveSessionStore() {
  return useRequired(LiveSessionContext, "useLiveSessionStore");
}

/** Selects one part of the page's live session. */
export function useLiveSession<T>(selector: (state: LiveSessionState) => T) {
  return useStore(useLiveSessionStore(), selector);
}
