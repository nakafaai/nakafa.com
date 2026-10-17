import { useIntersection } from "@mantine/hooks";
import { type ComponentProps, useEffect, useEffectEvent, useRef } from "react";

/** The observer's threshold when no share is given: any part of the element on the screen. */
const ANY_PART_THRESHOLD = 0.1;

export function Intersection({
  minimumRatio,
  onIntersect,
  root = null,
  rootMargin = "400px",
  once = false,
  ...props
}: {
  /**
   * The share of the element that must be on the screen before `onIntersect`
   * fires. The observer reports each crossing of this share, so the callback runs
   * as soon as the element reaches it. Left out, any part on the screen counts,
   * which is what the observer reports as intersecting.
   */
  minimumRatio?: number;
  onIntersect: () => void;
  /**
   * Keep `root` aligned with Mantine's `useIntersection`, which forwards to the
   * browser IntersectionObserver API:
   * https://mantine.dev/hooks/use-intersection/
   * https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
   */
  root?: Document | Element | null;
  rootMargin?: string;
  /** If true, onIntersect fires only once */
  once?: boolean;
} & ComponentProps<"div">) {
  // The observer reports the crossings that the callback tests, so a gradual entry reaches the share.
  const { ref, entry } = useIntersection({
    root,
    rootMargin,
    threshold: minimumRatio ?? ANY_PART_THRESHOLD,
  });
  const hasTriggered = useRef(false);
  const handleIntersect = useEffectEvent(onIntersect);

  // useEffect ensures side effect runs AFTER render (React rules)
  useEffect(() => {
    const onScreen =
      minimumRatio === undefined
        ? entry?.isIntersecting
        : (entry?.intersectionRatio ?? 0) >= minimumRatio;
    if (!onScreen) {
      return;
    }

    // Skip if already triggered and `once` is true
    if (once && hasTriggered.current) {
      return;
    }

    hasTriggered.current = true;
    handleIntersect();
  }, [entry, minimumRatio, once]);

  return <div ref={ref} {...props} />;
}
