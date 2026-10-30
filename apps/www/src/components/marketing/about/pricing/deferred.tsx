import { useMediaQuery, useMounted } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { lazy, Suspense } from "react";

/** The toys of the pricing page, whose code stays out of the page's first JavaScript. */
const PricingToys = lazy(() =>
  import("@/components/marketing/about/pricing/toys").then((module) => ({
    default: module.PricingToys,
  }))
);

/**
 * The toys of the pricing page, mounted as soon as React has taken the page
 * over on a page wide enough to place them, so they come on screen with the
 * plans and never wait for a scroll. The toys wait for their code inside their
 * own boundary: without it the page's boundary would hide the whole page while
 * the code loads. A layer that fails to load leaves the page as it is.
 */
export function DeferredPricingToys() {
  const mounted = useMounted();
  const wide = useMediaQuery(TAILWIND_MEDIA_QUERIES.lgAndUp);

  if (!(mounted && wide)) {
    return null;
  }

  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <Suspense fallback={null}>
          <PricingToys />
        </Suspense>
      </Suspense>
    </ErrorBoundary>
  );
}
