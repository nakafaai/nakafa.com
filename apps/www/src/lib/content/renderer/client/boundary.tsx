import { captureException } from "@repo/analytics/posthog/capture";
import { SceneFailure } from "@repo/design-system/components/three/failure";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { VisualCardNoteProvider } from "@repo/design-system/components/visual/card";
import { untilNearScreen } from "@repo/design-system/lib/screen";
import { useHydrated } from "@tanstack/react-router";
import { Deferred, Effect, Exit, Fiber, Option } from "effect";
import type { ComponentType, ReactNode } from "react";
import { Activity, Suspense, use, useEffect, useRef, useState } from "react";
import { isStaleChunkError } from "@/lib/chunks/stale";
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

/**
 * Renders its children, once the visual nears the screen when it waits for it. Until then the boundary keeps the
 * server's HTML. The server and the browser draw the same tree; only the browser's first load waits.
 */
function UntilNearScreen({
  children,
  wait,
}: {
  readonly children: ReactNode;
  readonly wait: Option.Option<ScreenWait>;
}) {
  if (Option.isSome(wait)) {
    use(wait.value.reached);
  }
  return children;
}

/**
 * Isolates a failing interactive visual inside its own card frame so one
 * broken 3D scene, sketch, or chart never crashes the surrounding lesson into
 * a full-page error screen. Stale deploy chunks re-throw so the route boundary
 * reloads once onto the active deploy.
 */
function VisualBoundaryFallback({
  error,
  resetErrorBoundary,
}: {
  readonly error: unknown;
  readonly resetErrorBoundary: () => void;
}) {
  if (isStaleChunkError(error)) {
    throw error;
  }
  return (
    <div className="bg-card relative my-6 min-h-64 w-full overflow-hidden rounded-xl border">
      <SceneFailure onRestart={resetErrorBoundary} />
    </div>
  );
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
 * 4x CPU right after hydration, wherever they stood (ADR 0039 D22). A visual of
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
    // Only the browser's first load of a served lesson waits: the server's
    // render and a client navigation draw the visual at once.
    const [wait] = useState(() =>
      hydrated || import.meta.env.SSR
        ? Option.none<ScreenWait>()
        : Option.some(makeScreenWait())
    );

    useEffect(() => {
      const target = box.current?.firstElementChild ?? box.current;
      if (Option.isNone(wait) || target === null) {
        return;
      }
      const { near } = wait.value;
      const watching = Effect.runFork(
        untilNearScreen(target, NEAR_SCREEN).pipe(
          Effect.andThen(
            Effect.sync(() => {
              Deferred.doneUnsafe(near, Exit.void);
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
          <ErrorBoundary
            FallbackComponent={VisualBoundaryFallback}
            onError={(error, info) => {
              if (!isStaleChunkError(error)) {
                captureException(error, {
                  component_stack: info.componentStack,
                  source: "visual-hydration-boundary",
                });
              }
            }}
            report={false}
          >
            <Activity mode="visible">
              <Suspense fallback={null}>
                <UntilNearScreen wait={wait}>
                  <Renderer {...props} />
                </UntilNearScreen>
              </Suspense>
            </Activity>
          </ErrorBoundary>
        </div>
      </VisualCardNoteProvider>
    );
  }
  // A client navigation settles the renderer's code with the page's tree
  // (`settle.ts`), so the renderer draws in the page's first frame.
  return Object.assign(HydrationBoundary, { [SETTLED_RENDERER]: Renderer });
}
