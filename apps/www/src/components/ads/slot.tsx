"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { untilNearScreen } from "@repo/design-system/lib/screen";
import { untilPageRead } from "@repo/design-system/lib/settle";
import { Effect, Fiber } from "effect";
import { Suspense, useEffect, useRef, useState } from "react";
import type { AdUnit } from "@/lib/ads/account";

/**
 * The frame's code, the audience it serves and the ad script: none of it is in
 * the page's first JavaScript, because a reader may never reach a frame.
 */
const AdAudience = lazy(() =>
  import("@/components/ads/placement").then((loaded) => ({
    default: loaded.AdAudience,
  }))
);

/** The frame itself, from the same module, so both arrive in one load. */
const AdMount = lazy(() =>
  import("@/components/ads/placement").then((loaded) => ({
    default: loaded.AdMount,
  }))
);

/** How far below the screen a slot opens, as a share of the screen: the frame stands before the reader gets there. */
const NEAR_SCREEN = "100%";

/**
 * The place of one ad frame between two sections of a lesson or an article. The
 * page's HTML holds only this empty place, so a crawler reads the content alone
 * and nothing takes room before the reader's plan is known. Once the page has
 * its reader (ADR 0039) and the place is within a screen of the view, it loads
 * the audience, which decides whether this reader sees a frame, and the frame.
 */
export function AdSlot({ unit }: { unit: AdUnit }) {
  const place = useRef<HTMLDivElement>(null);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    const target = place.current;
    if (target === null) {
      return;
    }
    const opening = Effect.runFork(
      Effect.all([untilNearScreen(target, NEAR_SCREEN), untilPageRead], {
        concurrency: "unbounded",
      }).pipe(Effect.andThen(Effect.sync(() => setOpen(true))))
    );
    return () => {
      Effect.runFork(Fiber.interrupt(opening));
    };
  }, []);

  return (
    <div data-ad-slot={unit} ref={place}>
      {isOpen ? (
        <Suspense fallback={null}>
          <AdAudience>
            <AdMount unit={unit} />
          </AdAudience>
        </Suspense>
      ) : null}
    </div>
  );
}
