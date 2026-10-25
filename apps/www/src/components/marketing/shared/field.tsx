import { useDocumentVisibility } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { DeferredParticles } from "@/components/shared/particles";

/**
 * The particle field behind a whole marketing page. It stays in the window while
 * the page scrolls under it, so every part has its particles from one canvas,
 * and it holds still while the page is hidden. Its height is the large viewport
 * height, which holds while a phone's address bar collapses and returns during a
 * scroll: a field that followed the bar would change size on every scroll, and
 * each size change draws every particle anew. The field is decoration: when its
 * code fails to load, the page stays without it, and the failure never reaches
 * the page's error page.
 */
export function PageField() {
  const visibility = useDocumentVisibility();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-lvh"
      data-slot="page-field"
    >
      <ErrorBoundary fallback={null}>
        <DeferredParticles
          className="absolute inset-0"
          paused={visibility === "hidden"}
        />
      </ErrorBoundary>
    </div>
  );
}
