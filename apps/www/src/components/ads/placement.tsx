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
import { loadAdScript, requestAd, untilFilled } from "@/lib/ads/script";
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
 * Mounts its frame only for a reader who should see ads, and renders nothing
 * while it decides. A visitor, whose browser holds no signed-in hint, gets it at
 * once. A hint waits for the page's session: a session that fails to load
 * renders nothing, since the reader may be on Pro, a stale hint is a visitor,
 * and a learner gets the frame only once the account says the plan is free. A
 * Pro learner never mounts the frame, so the ad script never loads for them.
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
    <SignedInIsland fallback={null}>
      <PlanAudience>{children}</PlanAudience>
    </SignedInIsland>
  );
}

/** A learner's audience: the frame for the free plan, and nothing while the account loads or for Pro. */
function PlanAudience({ children }: { children: ReactNode }) {
  const plan = useViewer((state) => state.account?.appUser.plan);
  return plan === "free" ? children : null;
}

/**
 * Asks AdSense for one unit's ad and shows the frame only once the ad is in it.
 * Until then the frame stands out of the page's flow, unseen and inert, at the
 * width it will have, so AdSense sizes the ad for it while the sections around
 * the place keep their spacing. The place opens a screen before the reader
 * reaches it, so an ad usually arrives while it is still under the screen, where
 * the frame moves nothing the reader sees. An ad that never comes, as while the
 * site waits for review, under an ad blocker or without consent, leaves the
 * page as if there were no frame.
 */
export function AdMount({ unit }: { unit: AdUnit }) {
  const slot = useRef<HTMLModElement>(null);
  const [isFilled, setFilled] = useState(false);

  useEffect(() => {
    const element = slot.current;
    if (element === null) {
      return;
    }
    const asking = Effect.runFork(
      loadAdScript.pipe(
        Effect.andThen(requestAd(element, window.location.hostname)),
        Effect.andThen(untilFilled(element)),
        Effect.andThen(Effect.sync(() => setFilled(true))),
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
    <div
      className="not-data-filled:invisible not-data-filled:absolute not-data-filled:inset-x-0 not-data-filled:top-0 data-filled:my-8"
      data-filled={isFilled ? "" : undefined}
      inert={!isFilled}
    >
      <AdFrame>
        <ins
          className="adsbygoogle block w-full"
          data-ad-client={AD_CLIENT}
          data-ad-format="auto"
          data-ad-slot={AD_SLOTS[unit]}
          data-full-width-responsive="false"
          ref={slot}
        />
      </AdFrame>
    </div>
  );
}
