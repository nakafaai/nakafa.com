import { wholeHeight } from "@repo/design-system/components/nina/height";
import { EmptyMedia } from "@repo/design-system/components/ui/empty";
import { lazy } from "@repo/design-system/lib/lazy";
import { type ComponentProps, Suspense } from "react";
import { EMPTY_NINA_SIZE } from "@/components/state/size";

/**
 * Nina and her two things, loaded only for the page that shows them. The
 * not-found and error states carry only this reference instead of a whole
 * figure, so their first JavaScript stays small. The server still draws the
 * picture for the page that needs it, and her place keeps its height until the
 * code arrives (`Screen`).
 */
const LazyDeferredFigure = lazy(() =>
  import("@/components/state/figure").then((module) => ({
    default: module.Figure,
  }))
);

export function DeferredFigure(
  props: ComponentProps<typeof LazyDeferredFigure>
) {
  return (
    <Suspense fallback={null}>
      <LazyDeferredFigure {...props} />
    </Suspense>
  );
}

/**
 * Nina in an empty state of a public page, whose first JavaScript keeps her code out: her place stands at her size
 * from the first frame, and she arrives into it, so nothing moves.
 */
const LazyEmptyNina = lazy(() =>
  import("@/components/state/nina").then((module) => ({
    default: module.EmptyNina,
  }))
);

export function DeferredEmptyNina(props: ComponentProps<typeof LazyEmptyNina>) {
  return (
    <Suspense
      fallback={
        <EmptyMedia
          style={{
            height: wholeHeight(EMPTY_NINA_SIZE),
            width: EMPTY_NINA_SIZE,
          }}
        />
      }
    >
      <LazyEmptyNina {...props} />
    </Suspense>
  );
}
