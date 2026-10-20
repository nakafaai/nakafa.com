import { useMediaQuery } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { lazy, Suspense, useState } from "react";

/** The toys of the pricing page. Their code loads only when the page reaches them. */
const PricingToys = lazy(() =>
  import("@/components/marketing/about/pricing/toys").then((module) => ({
    default: module.PricingToys,
  }))
);

/**
 * The toys of the pricing page, loaded when the sentinel between the plans and
 * the comparison comes on screen, and only on a page wide enough to place them.
 * The sentinel stays in the page, so the page does not move when the toys load,
 * and a reader who does not scroll never downloads them. The toys wait for
 * their code inside their own boundary: without it the page's boundary would
 * hide the whole page while the code loads, and the reader would land back at
 * the top. A layer that fails to load leaves the page as it is.
 */
export function DeferredPricingToys() {
  const [reached, setReached] = useState(false);
  const wide = useMediaQuery(TAILWIND_MEDIA_QUERIES.lgAndUp);

  return (
    <>
      <Intersection
        aria-hidden="true"
        className="h-px"
        once
        onIntersect={() => setReached(true)}
        rootMargin="0px"
      />
      {reached && wide ? (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <Suspense fallback={null}>
              <PricingToys />
            </Suspense>
          </Suspense>
        </ErrorBoundary>
      ) : null}
    </>
  );
}
