import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { lazy, Suspense } from "react";
import { useReachedPage } from "@/components/marketing/about/toys/reach";

/**
 * The toy layer's code. Its import starts only when the layer is first rendered,
 * which happens once the reader has acted on the page.
 */
const HomeToyLayer = lazy(async () => ({
  default: await (() =>
    import("@/components/marketing/about/toys/layer").then(
      (module) => module.HomeToyLayer
    ))(),
}));

/**
 * Mounts the toys once the reader has scrolled, moved the pointer or touched the
 * page. Until then the page holds no toy and downloads none of their code. A
 * layer that fails to load leaves the page as it is, and its absence never
 * reaches the error page.
 */
export function HomeToys() {
  const reached = useReachedPage();

  if (!reached) {
    return null;
  }

  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <Suspense fallback={null}>
          <HomeToyLayer />
        </Suspense>
      </Suspense>
    </ErrorBoundary>
  );
}
