import { ConvexProvider } from "convex/react";
import { Option } from "effect";
import { type ReactNode, useState } from "react";
import { useLiveSession } from "@/components/providers/live";

/**
 * The page's client for an island that `isReady` for it, or none while the island
 * keeps its variant. The two variants are different trees, so the swap replaces
 * every element, and a browser sends no click when the element it pressed leaves
 * the document before the release: a drawn variant stays while a pointer is down.
 * An island that mounts once the client exists has no variant to replace, and
 * starts live.
 */
function useIslandClient(isReady: boolean) {
  const client = useLiveSession((state) => state.client);
  const isPointerDown = useLiveSession((state) => state.isPointerDown);
  const canSwap = isReady && Option.isSome(client);
  const [isLive, setLive] = useState(canSwap);
  if (canSwap && !isLive && !isPointerDown) {
    setLive(true);
  }
  return isLive ? client : Option.none();
}

/**
 * Gives its children the page's one Convex client once the live session holds it,
 * and renders `fallback` until then. A visitor's page holds no client, so a leaf
 * that reads Convex mounts here and the visitor's variant shows instead. The
 * client is the store's, so every island of a page shares one socket. While a
 * learner's session still loads, the variant is inert, so a click waits for the
 * client instead of acting as a visitor's click, unless the variant `keepsPress`:
 * it answers a press in that moment itself, and shows it, so no press is lost.
 */
export function ConvexIsland({
  children,
  fallback = null,
  keepsPress = false,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  keepsPress?: boolean;
}) {
  const client = useIslandClient(true);
  const isSessionPending = useLiveSession((state) => state.isPending);
  if (Option.isNone(client)) {
    return (
      <div className="contents" inert={isSessionPending && !keepsPress}>
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
  const client = useIslandClient(isSignedIn);
  if (!isSignedIn || Option.isNone(client)) {
    return fallback;
  }
  return <ConvexProvider client={client.value}>{children}</ConvexProvider>;
}
