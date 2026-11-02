import { useTimeout, useWindowEvent } from "@mantine/hooks";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { Option } from "effect";
import { type ReactNode, useState } from "react";
import { useLiveSession } from "@/components/providers/live";

/** How long a released press keeps its element, so a click a touch screen sends late still finds it. */
const RELEASE_ROOM_MILLISECONDS = 100;

/**
 * Whether a pointer holds this island's variant. A browser sends no click when the
 * element it pressed leaves the document before the release, so the page's client
 * arriving under a press would lose it.
 */
function usePointerHold() {
  const [isHeld, setHeld] = useState(false);
  const room = useTimeout(() => setHeld(false), RELEASE_ROOM_MILLISECONDS);
  useWindowEvent("pointerup", () => room.start());
  useWindowEvent("pointercancel", () => room.start());
  return {
    hold: () => {
      room.clear();
      setHeld(true);
    },
    isHeld,
  };
}

/**
 * Renders `fallback` until `client` holds the page's client, then gives `children`
 * that client. The two are different trees, so the swap replaces every element of
 * the variant, and it waits for a pointer that holds one of them.
 */
function Island({
  children,
  client,
  fallback,
  inert,
}: {
  children: ReactNode;
  client: Option.Option<ConvexReactClient>;
  fallback: ReactNode;
  inert: boolean;
}) {
  const { hold, isHeld } = usePointerHold();
  if (Option.isNone(client) || isHeld) {
    return (
      <div className="contents" inert={inert} onPointerDown={hold}>
        {fallback}
      </div>
    );
  }
  return <ConvexProvider client={client.value}>{children}</ConvexProvider>;
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
  const client = useLiveSession((state) => state.client);
  const isSessionPending = useLiveSession((state) => state.isPending);
  return (
    <Island
      client={client}
      fallback={fallback}
      inert={isSessionPending && !keepsPress}
    >
      {children}
    </Island>
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
  const client = useLiveSession((state) => state.client);
  const isSignedIn = useLiveSession((state) => state.sessionId !== null);
  return (
    <Island
      client={isSignedIn ? client : Option.none()}
      fallback={fallback}
      inert={false}
    >
      {children}
    </Island>
  );
}
