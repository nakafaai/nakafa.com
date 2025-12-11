import { useIntersection } from "@mantine/hooks";
import { useEffect } from "react";

export function Intersection({
  onIntersect,
  root = null,
  rootMargin = "400px",
  threshold = 0.1,
}: {
  onIntersect: () => void;
  root?: null;
  rootMargin?: string;
  threshold?: number;
}) {
  const { ref, entry } = useIntersection({
    root,
    rootMargin,
    threshold,
  });

  useEffect(() => {
    if (entry?.isIntersecting) {
      onIntersect();
    }
  }, [entry, onIntersect]);

  return <div ref={ref} />;
}
