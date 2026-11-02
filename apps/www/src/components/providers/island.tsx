import { useTimeout, useWindowEvent } from "@mantine/hooks";
import { ConvexProvider } from "convex/react";
import { Option } from "effect";
import { type ReactNode, useState } from "react";
import { useLiveSession } from "@/components/providers/live";

/** How long a released press keeps its element, so a click a touch screen sends late still finds it. */
const RELEASE_ROOM_MILLISECONDS = 100;

/**
 * Whether a pointer holds this island's variant. A browser sends no click when the
 * element it pressed leaves the document before the release, so the page's client
 * arriving under a press would lose it. An island's two variants are different
 * trees, so its swap replaces every element, and it waits while this holds.
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
  const { hold, isHeld } = usePointerHold();
  if (Option.isNone(client) || isHeld) {
    return (
      <div
        className="contents"
        inert={isSessionPending && !keepsPress}
        onPointerDown={hold}
      >
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
  const client = useLiveSession((state) => state.client);
  const isSignedIn = useLiveSession((state) => state.sessionId !== null);
  const { hold, isHeld } = usePointerHold();
  if (!isSignedIn || Option.isNone(client) || isHeld) {
    return (
      <div className="contents" onPointerDown={hold}>
        {fallback}
      </div>
    );
  }
  return <ConvexProvider client={client.value}>{children}</ConvexProvider>;
}
