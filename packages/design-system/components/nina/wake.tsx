import { Frame } from "@repo/design-system/components/nina/frame";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { modeOf, type Options } from "@repo/mascot/nina/options";
import { Array as Arr, Effect } from "effect";
import { type ReactNode, startTransition, useState } from "react";

/** Her life as a module: her motion and the numbers she is drawn from. */
type Life = typeof import("@repo/design-system/components/nina/live");

/**
 * Loads her life when it is asked for and hands it over in a transition, so
 * none of it is in the first JavaScript of a page. A load that fails hands
 * nothing over, and she stays the picture she was.
 *
 * It is loaded by hand and not through `lazy` with a `Suspense`. React keeps
 * the error of a boundary that the server could not finish (a page that turned
 * out not to exist) and reports it when the next `Suspense` completes, so a
 * boundary of hers that mounts after hydration would log that error on every
 * not-found page.
 */
function loadLife(then: (life: Life) => void) {
  Effect.runFork(
    Effect.tryPromise(
      () => import("@repo/design-system/components/nina/live")
    ).pipe(
      Effect.tap((life) =>
        Effect.sync(() => {
          startTransition(() => {
            then(life);
          });
        })
      ),
      Effect.ignore
    )
  );
}

interface WakeProps {
  /** The picture of her that a server drew, which stays until her life is loaded. */
  children: ReactNode;
  label: string;
  options: Options;
  size: number;
}

/** Tells `then` when the element comes within 300 pixels of the screen. Answers what ends the watch. */
function whenNear(element: Element, then: () => void) {
  const near = new IntersectionObserver(
    (entries) => {
      if (Arr.some(entries, ({ isIntersecting }) => isIntersecting)) {
        then();
      }
    },
    { rootMargin: "300px" }
  );
  near.observe(element);
  return () => near.disconnect();
}

/**
 * Keeps her picture still until she nears the screen, or a pointer comes to
 * her, and then loads her life. The observer's own callback wakes her, and so
 * does the pointer; her frame is a `span` that cannot take the focus, so
 * nothing else does. The picture stays in place while the code loads, and her
 * life takes over from it in one step, so nothing flashes and nothing moves.
 * When her life cannot load or breaks, the picture stays too: she stands in
 * her pose, and the page around her never sees the failure.
 */
export function Wake({ children, label, options, size }: WakeProps) {
  const [life, setLife] = useState<Life>();
  const mode = modeOf(options);
  const still = <Frame mode={mode}>{children}</Frame>;

  if (life !== undefined) {
    return (
      <ErrorBoundary fallback={still}>
        <life.Live key={mode} label={label} options={options} size={size} />
      </ErrorBoundary>
    );
  }

  const wake = () => {
    loadLife(setLife);
  };

  return (
    <Frame
      mode={mode}
      onPointerEnter={wake}
      ref={(frame) => (frame === null ? undefined : whenNear(frame, wake))}
    >
      {children}
    </Frame>
  );
}
