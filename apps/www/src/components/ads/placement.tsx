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
import { SignedInIsland } from "@/components/providers/island";
import { useLiveSession } from "@/components/providers/live";
import { AD_CLIENT, AD_SLOTS, type AdUnit } from "@/lib/ads/account";
import {
  isAdTest,
  loadAdScript,
  requestAd,
  untilUnfilled,
} from "@/lib/ads/script";
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
 * Shows its frame only to a reader who should see ads. A visitor, whose browser
 * holds no signed-in hint, sees it at once. A hint waits for the page's session:
 * a session that fails to load shows nothing, since the reader may be on Pro, a
 * stale hint is a visitor, and a learner sees the frame only once the account
 * says the plan is free. A Pro learner never mounts the frame, so the ad script
 * never loads for them.
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
  if (hasError || !settled) {
    return null;
  }
  if (!signedIn) {
    return children;
  }
  return (
    <SignedInIsland>
      <PlanAudience>{children}</PlanAudience>
    </SignedInIsland>
  );
}

/** A learner's audience: the frame for the free plan, nothing for Pro or while the account loads. */
function PlanAudience({ children }: { children: ReactNode }) {
  const plan = useViewer((state) => state.account?.appUser.plan);
  return plan === "free" ? children : null;
}

/**
 * Puts one frame on the page without moving anything the reader sees. The frame
 * appears only while its place stands under the screen, so the text below it
 * moves out of sight. Once it stands, the ad script loads and the unit asks for
 * its ad once. When AdSense has no ad, or the script cannot load, the frame goes
 * again, also only while it stands under the screen.
 */
export function AdMount({ unit }: { unit: AdUnit }) {
  const place = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLModElement>(null);
  const [stage, setStage] = useState<"waiting" | "standing" | "gone">(
    "waiting"
  );

  useEffect(() => {
    const target = place.current;
    const element = slot.current;
    if (target === null || stage === "gone") {
      return;
    }
    if (stage === "standing" && element === null) {
      return;
    }
    const next =
      element === null
        ? untilBelowScreen(target).pipe(
            Effect.andThen(Effect.sync(() => setStage("standing")))
          )
        : loadAdScript.pipe(
            Effect.andThen(requestAd(element)),
            Effect.andThen(untilUnfilled(element)),
            // A script an ad blocker or the network stopped leaves the unit
            // empty for good, as AdSense's own no-ad answer does.
            Effect.catchTag("AdScriptFailed", () => Effect.void),
            Effect.andThen(untilBelowScreen(target)),
            Effect.andThen(Effect.sync(() => setStage("gone")))
          );
    const running = Effect.runFork(next);
    return () => {
      Effect.runFork(Fiber.interrupt(running));
    };
  }, [stage]);

  return (
    <div ref={place}>
      {stage === "standing" ? (
        <AdFrame>
          <ins
            className="adsbygoogle block h-70 w-full"
            data-ad-client={AD_CLIENT}
            data-ad-slot={AD_SLOTS[unit]}
            data-adtest={isAdTest(window.location.hostname) ? "on" : undefined}
            ref={slot}
          />
        </AdFrame>
      ) : null}
    </div>
  );
}
