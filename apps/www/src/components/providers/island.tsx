import { ConvexProvider } from "convex/react";
import { Effect, Fiber, Option } from "effect";
import { type ReactNode, useEffect } from "react";
import {
  useLiveSession,
  useLiveSessionStore,
} from "@/components/providers/live";
import { clientEnv } from "@/env.public";
import { openLiveClient } from "@/lib/auth/live";

/**
 * Gives its children the page's one Convex client once the live session holds it,
 * and renders `fallback` until then. A visitor's page holds no client, so a leaf
 * that reads Convex mounts here and the visitor's variant shows instead. The
 * client is the store's, so every island of a page shares one socket.
 */
export function ConvexIsland({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const client = useLiveSession((state) => state.client);
  if (Option.isNone(client)) {
    return fallback;
  }
  return <ConvexProvider client={client.value}>{children}</ConvexProvider>;
}

/**
 * An island whose reader's intent needs a client even as a visitor, such as an
 * opened search. Mounting it opens the page's client, once, and the children mount
 * when the client exists. A hinted page already has its client from the session.
 */
export function ConvexIntentIsland({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const store = useLiveSessionStore();

  useEffect(() => {
    const opening = Effect.runFork(
      openLiveClient(store, {
        convexUrl: clientEnv.VITE_CONVEX_URL,
        cookie: document.cookie,
      })
    );
    return () => {
      Effect.runFork(Fiber.interrupt(opening));
    };
  }, [store]);

  return <ConvexIsland fallback={fallback}>{children}</ConvexIsland>;
}
