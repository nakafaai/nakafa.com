import { ConvexProvider } from "convex/react";
import { Option } from "effect";
import type { ReactNode } from "react";
import { useLiveSession } from "@/components/providers/live";

/**
 * Gives its children the page's one Convex client once the live session holds it,
 * and renders `fallback` until then. A visitor's page holds no client, so a leaf
 * that reads Convex mounts here and the visitor's variant shows instead. The
 * client is the store's, so every island of a page shares one socket. While a
 * learner's session still loads, the variant is inert, so a click waits for the
 * client instead of acting as a visitor's click.
 */
export function ConvexIsland({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const client = useLiveSession((state) => state.client);
  const isSessionPending = useLiveSession((state) => state.isPending);
  if (Option.isNone(client)) {
    return (
      <div className="contents" inert={isSessionPending}>
        {fallback}
      </div>
    );
  }
  return <ConvexProvider client={client.value}>{children}</ConvexProvider>;
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
