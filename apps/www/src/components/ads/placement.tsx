import { untilBelowScreen } from "@repo/design-system/lib/screen";
import { Effect, Fiber, Function as Fn, Option } from "effect";
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AdFrame } from "@/components/ads/frame";
import { AdSpace } from "@/components/ads/space";
import { SignedInIsland } from "@/components/providers/island";
import { useLiveSession } from "@/components/providers/live";
import { AD_CLIENT, AD_SLOTS, type AdUnit } from "@/lib/ads/account";
import { loadAdScript, requestAd } from "@/lib/ads/script";
import { hasSignedInHint } from "@/lib/auth/hint";
import { useViewer } from "@/lib/identity/client";

/** A mounted placement reads the hint once: a sign-in or a sign-out reloads the page's session anyway. */
function subscribeOnce() {
  return Fn.constVoid;
}

/** Whether the browser holds the signed-in hint, so the page may have a learner. */
function readSignedInHint() {
  return hasSignedInHint(document.cookie);
}

/**
 * Shows its frame only to a reader who should see ads, and keeps the frame's
 * room while it decides. A visitor, whose browser holds no signed-in hint, sees
 * it at once. A hint waits for the page's session: a session that fails to load
 * shows nothing, since the reader may be on Pro, a stale hint is a visitor, and
 * a learner sees the frame only once the account says the plan is free. A Pro
 * learner never mounts the frame, so the ad script never loads for them.
 */
export function AdAudience({ children }: { children: ReactNode }) {
  const hasHint = useSyncExternalStore(
    subscribeOnce,
    readSignedInHint,
    Fn.constTrue
  );
  return hasHint ? <AccountAudience>{children}</AccountAudience> : children;
}

/** The audience of a page whose browser may hold a session, once that session has settled. */
function AccountAudience({ children }: { children: ReactNode }) {
  const hasError = useLiveSession((state) => state.hasError);
  const settled = useLiveSession(
    (state) => Option.isSome(state.client) && !state.isPending
  );
  const signedIn = useLiveSession((state) => state.sessionId !== null);
  if (hasError) {
    return <AdGap />;
  }
  if (!settled) {
    return <AdSpace />;
  }
  if (!signedIn) {
    return children;
  }
  return (
    <SignedInIsland fallback={<AdSpace />}>
      <PlanAudience>{children}</PlanAudience>
    </SignedInIsland>
  );
}

/** A learner's audience: the frame for the free plan, the room while the account loads, and no frame for Pro. */
function PlanAudience({ children }: { children: ReactNode }) {
  const plan = useViewer((state) => state.account?.appUser.plan);
  if (plan === undefined) {
    return <AdSpace />;
  }
  return plan === "free" ? children : <AdGap />;
}

/**
 * The room of a frame this reader never sees. It goes only while it stands
 * under the screen, so the text below it moves out of sight; a room the reader
 * already passed stays until they scroll back above it.
 */
function AdGap() {
  const space = useRef<HTMLDivElement>(null);
  const [isGone, setGone] = useState(false);

  useEffect(() => {
    const target = space.current;
    if (target === null) {
      return;
    }
    const leaving = Effect.runFork(
      untilBelowScreen(target).pipe(
        Effect.andThen(Effect.sync(() => setGone(true)))
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(leaving));
    };
  }, []);

  return isGone ? null : <AdSpace ref={space} />;
}

/**
 * Puts one frame in the room its place holds, so nothing the reader sees moves.
 * The ad script loads and the unit asks for its ad once. When AdSense has no ad,
 * or the script cannot load, the frame stays as it stands, so the room never
 * closes under the reader.
 */
export function AdMount({ unit }: { unit: AdUnit }) {
  const slot = useRef<HTMLModElement>(null);

  useEffect(() => {
    const element = slot.current;
    if (element === null) {
      return;
    }
    const asking = Effect.runFork(
      loadAdScript.pipe(
        Effect.andThen(requestAd(element, window.location.hostname)),
        // A script an ad blocker or the network stopped leaves the unit
        // empty, as AdSense's own no-ad answer does.
        Effect.catchTag("AdScriptFailed", () => Effect.void)
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(asking));
    };
  }, []);

  return (
    <AdSpace>
      <AdFrame>
        <ins
          className="adsbygoogle block w-full flex-1"
          data-ad-client={AD_CLIENT}
          data-ad-slot={AD_SLOTS[unit]}
          ref={slot}
        />
      </AdFrame>
    </AdSpace>
  );
}
