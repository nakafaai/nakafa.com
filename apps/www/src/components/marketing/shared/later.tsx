import { untilNearScreen } from "@repo/design-system/lib/screen";
import { untilPageRead } from "@repo/design-system/lib/settle";
import { Deferred, Effect, Exit, Fiber, Option } from "effect";
import type { ComponentType, ReactNode } from "react";
import { Suspense, use, useEffect, useRef } from "react";
import type { LaterCode } from "@/components/marketing/shared/code";
import {
  holdsEarlyPress,
  readWaiting,
} from "@/components/marketing/shared/code";

/** How far past the screen a section starts to load its code, as a share of the screen. */
const NEAR_SCREEN = "50%";

/** Renders the section once its code is here. Until then its boundary keeps the server's HTML on screen. */
function LaterBody<Props extends object>({
  children,
  code,
}: {
  children: (Section: ComponentType<Props>) => ReactNode;
  code: LaterCode<Props>;
}) {
  return children(
    Option.isSome(code.component)
      ? code.component.value
      : use(readWaiting(code))
  );
}

/**
 * One section after the hero, in a hydration boundary of its own. The static page
 * draws every section from its HTML at once. The section's code starts to load
 * once the page has its reader and the section is near the screen
 * (`untilPageRead`: the reader's first gesture, or ten seconds on a page nobody
 * touches, ADR 0039 D17), or at once for a section whose control the reader
 * pressed before React took the page over. React then hydrates it at the lowest
 * priority, in small slices, so a phone never pays for a part of the page that the
 * reader has not reached. The browser also skips the layout of a section far from
 * the screen, and holds the height of one screen, bounded as every part is
 * (`--marketing-screen`), for it until then (`later-section`; `layOutDownTo` lays
 * out every box down to a jump's target before the scroll). This box is the only
 * one that skips: inside a second skipped box WebKit's `scrollIntoView` does not
 * scroll to an element of the section, and Firefox and WebKit lose the section's
 * scroll margin. That skipping also clips the box at its padding edge, so the box
 * reaches a little past its section, with the same margin taken back, and a ring
 * or a shadow on the section's last line stays whole. The boundary sits under a box
 * that holds no state, so nothing that changes here reaches the section's HTML
 * while it waits.
 */
export function LaterSection<Props extends object>({
  children,
  code,
}: {
  children: (Section: ComponentType<Props>) => ReactNode;
  code: LaterCode<Props>;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = box.current;
    if (target === null) {
      return;
    }
    // A control the reader pressed before React took the page over waits for this
    // section's code, and its press can open a picker only for a few seconds.
    if (holdsEarlyPress(target)) {
      Deferred.doneUnsafe(code.near, Exit.void);
      return;
    }
    const opening = Effect.runFork(
      untilNearScreen(target, NEAR_SCREEN).pipe(
        Effect.andThen(untilPageRead),
        Effect.andThen(
          Effect.sync(() => {
            Deferred.doneUnsafe(code.near, Exit.void);
          })
        )
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(opening));
    };
  }, [code]);

  return (
    <div className="later-section -my-2 py-2" ref={box}>
      <Suspense fallback={null}>
        <LaterBody code={code}>{children}</LaterBody>
      </Suspense>
    </div>
  );
}
