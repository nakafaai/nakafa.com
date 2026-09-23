"use client";

import { type ComponentProps, lazy, Suspense } from "react";

const Plot = lazy(() =>
  import(
    "@repo/design-system/components/contents/mathematics/exponential/plot"
  ).then(({ ExponentialPlot }) => ({ default: ExponentialPlot }))
);

/** Defers the interactive plot while the server keeps its table and formula visible. */
export function ExponentialPlot(props: ComponentProps<typeof Plot>) {
  return (
    <Suspense fallback={null}>
      <Plot {...props} />
    </Suspense>
  );
}
