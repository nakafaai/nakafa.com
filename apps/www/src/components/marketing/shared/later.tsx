import { untilPageSettled } from "@repo/design-system/lib/settle";
import { Deferred, Effect, Exit, Fiber, Option } from "effect";
import {
  type ComponentType,
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useRef,
} from "react";

/** How far past the screen a section starts to load its code, as a share of the screen. */
const NEAR_SCREEN = "50%";

/**
 * The code of one section under the first screen. The page's HTML already holds
 * the section, so its JavaScript is left out of the page's first load: it loads
 * when the section nears the screen, and a client navigation loads it before the
 * page commits. The component is kept here once it has loaded, so a later render
 * reads it at once and never suspends.
 */
export interface LaterCode<Props extends object> {
  component: Option.Option<ComponentType<Props>>;
  readonly load: () => Promise<ComponentType<Props>>;
  loading: Option.Option<Promise<ComponentType<Props>>>;
  readonly near: Deferred.Deferred<void>;
}

/** Declares the code of a section, which starts to load only when it is opened. */
export function laterCode<Props extends object>(
  load: () => Promise<ComponentType<Props>>
): LaterCode<Props> {
  return {
    component: Option.none(),
    load,
    loading: Option.none(),
    near: Deferred.makeUnsafe(),
  };
}

/** The one promise of a section's code, which waits until the section is opened. */
function readLoading<Props extends object>(code: LaterCode<Props>) {
  return Option.getOrElse(code.loading, () => {
    const loading = Deferred.await(code.near).pipe(
      Effect.andThen(Effect.promise(code.load)),
      Effect.tap((component) =>
        Effect.sync(() => {
          code.component = Option.some(component);
        })
      ),
      Effect.runPromise
    );
    code.loading = Option.some(loading);
    return loading;
  });
}

/** Lets a section's code load, and answers once it has. */
export function openLaterCode<Props extends object>(code: LaterCode<Props>) {
  Deferred.doneUnsafe(code.near, Exit.void);
  return readLoading(code);
}

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
      : use(readLoading(code))
  );
}

/**
 * One section after the hero, in a hydration boundary of its own. The static page
 * draws every section from its HTML at once. The section's code starts to load
 * once the page has settled and the section is near the screen, then React
 * hydrates it at the lowest priority, in small slices, so a phone never pays for a
 * part of the page that the reader has not reached. The browser also skips the
 * layout of a section far from the screen, and holds the height of one screen for
 * it until then. The boundary sits under a box that holds no state, so nothing
 * that changes here reaches the section's HTML while it waits.
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
    const opening = Effect.runFork(
      Effect.callback<void>((resume) => {
        const watcher = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              resume(Effect.void);
            }
          },
          { rootMargin: `${NEAR_SCREEN} 0px` }
        );
        watcher.observe(target);
        return Effect.sync(() => watcher.disconnect());
      }).pipe(
        Effect.andThen(untilPageSettled),
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
    <div
      className="[contain-intrinsic-block-size:auto_100lvh] [content-visibility:auto]"
      ref={box}
    >
      <Suspense fallback={null}>
        <LaterBody code={code}>{children}</LaterBody>
      </Suspense>
    </div>
  );
}
