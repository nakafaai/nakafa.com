import { type ComponentProps, lazy, Suspense } from "react";

/**
 * Nina and her two things, loaded only for the page that shows them. The
 * not-found and error states carry only this reference instead of a whole
 * figure, so their first JavaScript stays small. The server still draws the
 * picture for the page that needs it, and her place keeps its height until the
 * code arrives (`Screen`).
 */
const LazyDeferredFigure = lazy(async () => ({
  default: await (() =>
    import("@/components/state/figure").then((module) => module.Figure))(),
}));

export function DeferredFigure(
  props: ComponentProps<typeof LazyDeferredFigure>
) {
  return (
    <Suspense fallback={null}>
      <LazyDeferredFigure {...props} />
    </Suspense>
  );
}
