"use client";

import { useIntersection } from "@mantine/hooks";
import { Frame } from "@repo/design-system/components/nina/frame";
import type { Options } from "@repo/mascot/nina/figure";
import { modeOf } from "@repo/mascot/nina/mode";
import {
  lazy,
  type ReactNode,
  Suspense,
  startTransition,
  useEffect,
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

/**
 * Keeps her picture still until she nears the screen, or a pointer or the
 * focus comes to her, and then loads her life. The picture stays in place while
 * the code loads, and her life takes over from it in one step, so nothing
 * flashes and nothing moves.
 */
export function Wake({ children, label, options, size }: WakeProps) {
  const [awake, setAwake] = useState(false);
  const { entry, ref } = useIntersection({ rootMargin: "300px" });
  const near = entry?.isIntersecting === true;
  const edge = modeOf(options) === "peek";
  const wake = () => {
    startTransition(() => {
      setAwake(true);
    });
  };

  useEffect(() => {
    if (near) {
      startTransition(() => {
        setAwake(true);
      });
    }
  }, [near]);

  return awake ? (
    <Suspense fallback={<Frame edge={edge}>{children}</Frame>}>
      <Live key={modeOf(options)} label={label} options={options} size={size} />
    </Suspense>
  ) : (
    <Frame edge={edge} onFocus={wake} onPointerEnter={wake} ref={ref}>
      {children}
    </Frame>
  );
}
