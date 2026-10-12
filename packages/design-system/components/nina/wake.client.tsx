"use client";

import { Frame } from "@repo/design-system/components/nina/frame";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { modeOf, type Options } from "@repo/mascot/nina/options";
import { Array as Arr } from "effect";
import {
  lazy,
  type ReactNode,
  Suspense,
  startTransition,
  useState,
} from "react";

/**
 * Her life is loaded only when she is needed, so none of it is in the first
 * JavaScript of a page: not her motion, and not the numbers she is drawn from.
 */
const Live = lazy(() =>
  import("@repo/design-system/components/nina/live.client").then((module) => ({
    default: module.Live,
  }))
);

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
  const [awake, setAwake] = useState(false);
  const mode = modeOf(options);
  const wake = () => {
    startTransition(() => {
      setAwake(true);
    });
  };

  const still = <Frame mode={mode}>{children}</Frame>;

  return awake ? (
    <ErrorBoundary fallback={still}>
      <Suspense fallback={still}>
        <Live key={mode} label={label} options={options} size={size} />
      </Suspense>
    </ErrorBoundary>
  ) : (
    <Frame
      mode={mode}
      onPointerEnter={wake}
      ref={(frame) => (frame === null ? undefined : whenNear(frame, wake))}
    >
      {children}
    </Frame>
  );
}
