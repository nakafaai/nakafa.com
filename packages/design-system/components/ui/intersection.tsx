import { useIntersection } from "@mantine/hooks";
import { type ComponentProps, useEffect, useRef } from "react";

export function Intersection({
  onIntersect,
  root = null,
  rootMargin = "400px",
  threshold = 0.1,
  once = false,
  ...props
}: {
  onIntersect: () => void;
  root?: null;
  rootMargin?: string;
  threshold?: number;
  /** If true, onIntersect fires only once */
  once?: boolean;
} & ComponentProps<"div">) {
  const { ref, entry } = useIntersection({
    root,
    rootMargin,
    threshold,
  });
  const hasTriggered = useRef(false);

  // useEffect ensures side effect runs AFTER render (React rules)
  useEffect(() => {
    if (!entry?.isIntersecting) {
      return;
    }

    // Skip if already triggered and `once` is true
    if (once && hasTriggered.current) {
      return;
    }

    hasTriggered.current = true;
    onIntersect();
  }, [entry, onIntersect, once]);

  return <div ref={ref} {...props} />;
}
