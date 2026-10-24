"use client";

import { type ComponentProps, lazy, Suspense } from "react";

/** Defers the interactive highlighter until an authored code block renders. */
const LazyCodeBlockMdx = lazy(() =>
  import("@repo/design-system/components/markdown/code/block").then(
    (module) => ({ default: module.CodeBlockMdx })
  )
);

export function CodeBlockMdx(props: ComponentProps<typeof LazyCodeBlockMdx>) {
  return (
    <Suspense fallback={null}>
      <LazyCodeBlockMdx {...props} />
    </Suspense>
  );
}
