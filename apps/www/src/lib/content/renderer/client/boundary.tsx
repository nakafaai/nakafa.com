import { VisualCardNoteProvider } from "@repo/design-system/components/visual/card";
import { untilNearScreen } from "@repo/design-system/lib/screen";
import { useHydrated } from "@tanstack/react-router";
import { Deferred, Effect, Exit, Fiber } from "effect";
import type { ComponentType, ReactNode } from "react";
import { Activity, Suspense, use, useEffect, useRef, useState } from "react";
import { SETTLED_RENDERER } from "@/lib/static/settle";

/** How far past the screen a visual of a served lesson starts to hydrate, as a share of the screen. */
const NEAR_SCREEN = "50%";

/** A visual's wait for the screen: done once the visual nears it, and the promise React waits on. */
interface ScreenWait {
  readonly near: Deferred.Deferred<void>;
  readonly reached: Promise<void>;
}

/** A wait that the visual's box completes once it nears the screen. */
function makeScreenWait(): ScreenWait {
  const near = Deferred.makeUnsafe<void>();
  return { near, reached: Effect.runPromise(Deferred.await(near)) };
}

/** Renders its children once the visual nears the screen. Until then the boundary keeps the server's HTML. */
function UntilNearScreen({
  children,
  wait,
}: {
  readonly children: ReactNode;
  readonly wait: ScreenWait;
}) {
  use(wait.reached);
  return children;
}

/**
 * Gives a lesson renderer whose code loads on demand its own hydration
 * boundary.
 *
 * A `React.lazy` renderer suspends on its first render even once its chunk has
 * loaded. Without a boundary of its own, that
 * suspension holds the hydration of the whole lesson, and a press that lands
 * meanwhile cannot hydrate it synchronously: React client-renders the lesson
 * and the press is lost. A visible `Activity` lets React hydrate the lesson
 * around the renderer, which hydrates on its own once its code is ready.
 * Unlike a Suspense boundary it has no fallback, so a client navigation still
 * waits for the renderer before it shows the lesson: the loader settles the
 * renderer's code with the lesson's tree.
 * https://react.dev/reference/react/Activity
 *
 * On a served lesson the renderer loads its code and hydrates only once its box
 * nears the screen. Until then React keeps the server's HTML of the visual, so
 * a chart, a scene or a lab under the first screen costs a slow phone nothing
 * while the lesson loads: the charts of a lesson drew in tasks of up to 284 ms at
 * 4x CPU right after hydration, wherever they stood (ADR 0039 D21). A visual of
 * a client navigation draws at once, in the page's first frame.
 *
 * The document's `footer`, the note its author wrote under a visual, goes to
 * the visual's card through `VisualCardNoteProvider`, so every visual of the
 * catalog ends with its note without reading it itself.
 */
export function withHydrationBoundary<P extends object>(
  Renderer: ComponentType<P>
) {
  function HydrationBoundary(props: P & { readonly footer?: ReactNode }) {
    const hydrated = useHydrated();
    const box = useRef<HTMLDivElement>(null);
    // Only a served lesson waits: the server and a client navigation draw the
    // visual at once.
    const [wait] = useState(() =>
      hydrated || typeof window === "undefined" ? null : makeScreenWait()
    );

    useEffect(() => {
      const target = box.current?.firstElementChild ?? box.current;
      if (wait === null || target === null) {
        return;
      }
      const watching = Effect.runFork(
        untilNearScreen(target, NEAR_SCREEN).pipe(
          Effect.andThen(
            Effect.sync(() => {
              Deferred.doneUnsafe(wait.near, Exit.void);
            })
          )
        )
      );
      return () => {
        Effect.runFork(Fiber.interrupt(watching));
      };
    }, [wait]);

    return (
      <VisualCardNoteProvider note={props.footer}>
        <div ref={box}>
          <Activity mode="visible">
            <Suspense fallback={null}>
              {wait === null ? (
                <Renderer {...props} />
              ) : (
                <UntilNearScreen wait={wait}>
                  <Renderer {...props} />
                </UntilNearScreen>
              )}
            </Suspense>
          </Activity>
        </div>
      </VisualCardNoteProvider>
    );
  }
  // A client navigation settles the renderer's code with the page's tree
  // (`settle.ts`), so the renderer draws in the page's first frame.
  return Object.assign(HydrationBoundary, { [SETTLED_RENDERER]: Renderer });
}
