import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { AfterPageRead } from "@repo/design-system/components/ui/settled";
import { lazy, Suspense } from "react";

/**
 * The toy layer's code, which stays out of the page's first JavaScript. Its
 * import starts when the layer is first rendered.
 */
const HomeToyLayer = lazy(() =>
  import("@/components/marketing/about/toys/layer").then((module) => ({
    default: module.HomeToyLayer,
  }))
);

/**
 * Mounts the toys once the page has its reader, so they come on screen at the
 * first gesture, or by themselves a few seconds after the page settles, and their
 * animations never compete with the page's own loading. A toy needs the live layout to find its place,
 * so the server draws none. A layer that fails to load leaves the page as it
 * is, and its absence never reaches the error page.
 */
export function HomeToys() {
  return (
    <AfterPageRead>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <Suspense fallback={null}>
            <HomeToyLayer />
          </Suspense>
        </Suspense>
      </ErrorBoundary>
    </AfterPageRead>
  );
}
