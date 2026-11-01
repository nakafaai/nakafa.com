import { lazyRouteComponent } from "@tanstack/react-router";
import { type ComponentProps, Suspense } from "react";

/** The review's code, which reaches KaTeX and the Markdown reader. */
const LazyTryoutReview = lazyRouteComponent(
  () => import("@/components/tryout/review/screen"),
  "TryoutAttemptReview"
);

/**
 * The review of a finished attempt. A page without a finished attempt never reads its code, so it stays
 * out of the page's first JavaScript, and the page holds no invented review while it loads.
 */
export function TryoutAttemptReview(
  props: ComponentProps<typeof LazyTryoutReview>
) {
  return (
    <Suspense fallback={null}>
      <LazyTryoutReview {...props} />
    </Suspense>
  );
}
