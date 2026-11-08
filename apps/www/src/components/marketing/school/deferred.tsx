import { useMediaQuery } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { AfterPageRead } from "@repo/design-system/components/ui/settled";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { lazy } from "@repo/design-system/lib/lazy";
import { Suspense } from "react";

/** The toys of each School page, whose code stays out of the page's first JavaScript. */
const PAGE_TOYS = {
  landing: lazy(() =>
    import("@/components/marketing/school/toys").then((module) => ({
      default: module.SchoolToys,
    }))
  ),
  pricing: lazy(() =>
    import("@/components/marketing/school/toys").then((module) => ({
      default: module.SchoolPricingToys,
    }))
  ),
};

/**
 * The toys of a School page, mounted once the page has its reader on a page
 * wide enough to place them, as the pricing page mounts its own (ADR 0039), so
 * their animations never compete with the page's own loading. The toys wait for
 * their code inside their own boundary, and a layer that fails to load leaves
 * the page as it is.
 */
export function DeferredSchoolToys({ page }: { page: keyof typeof PAGE_TOYS }) {
  const Toys = PAGE_TOYS[page];
  const wide = useMediaQuery(TAILWIND_MEDIA_QUERIES.lgAndUp);

  if (!wide) {
    return null;
  }

  return (
    <AfterPageRead>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <Suspense fallback={null}>
            <Toys />
          </Suspense>
        </Suspense>
      </ErrorBoundary>
    </AfterPageRead>
  );
}
