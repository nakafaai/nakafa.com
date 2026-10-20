import { ConvexProvider } from "convex/react";
import { Option } from "effect";
import type { ReactNode } from "react";
import { useLiveSession } from "@/components/providers/live";
import { clientEnv } from "@/env.public";
import { readConvexClient } from "@/lib/convex/client";

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
 * Gives its children Convex for a reader whose intent needs a client even as a
 * visitor, such as an opened search. It provides the shared client and nothing
 * else: the live session does not hold it, so no other island of the page mounts
 * for that visitor.
 */
export function ConvexIntentIsland({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={readConvexClient(clientEnv.VITE_CONVEX_URL)}>
      {children}
    </ConvexProvider>
  );
}

/**
 * Mounts the page's client for a signed-in session only. A stale signed-in hint
 * can hold the client without a session, so a reader that shows the account waits
 * for Convex to confirm one, and renders `fallback` until then.
 */
export function SignedInIsland({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const isSignedIn = useLiveSession((state) => state.sessionId !== null);
  if (!isSignedIn) {
    return fallback;
  }
  return <ConvexIsland fallback={fallback}>{children}</ConvexIsland>;
}
