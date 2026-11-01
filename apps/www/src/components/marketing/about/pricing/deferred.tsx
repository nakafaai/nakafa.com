import { useMediaQuery } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { AfterPageRead } from "@repo/design-system/components/ui/settled";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { lazy } from "@repo/design-system/lib/lazy";
import { Suspense } from "react";

/** The toys of the pricing page, whose code stays out of the page's first JavaScript. */
const PricingToys = lazy(() =>
  import("@/components/marketing/about/pricing/toys").then((module) => ({
    default: module.PricingToys,
  }))
);

/**
 * The toys of the pricing page, mounted once the page has its reader on a page
 * wide enough to place them, so their animations never compete with the page's
 * own loading. The toys
 * wait for their code inside their own boundary: without it the page's boundary
 * would hide the whole page while the code loads. A layer that fails to load
 * leaves the page as it is.
 */
export function DeferredPricingToys() {
  const wide = useMediaQuery(TAILWIND_MEDIA_QUERIES.lgAndUp);

  if (!wide) {
    return null;
  }

  return (
    <AfterPageRead>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <Suspense fallback={null}>
            <PricingToys />
          </Suspense>
        </Suspense>
      </ErrorBoundary>
    </AfterPageRead>
  );
}
