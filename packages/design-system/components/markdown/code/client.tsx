"use client";

import { type ComponentProps, lazy, Suspense } from "react";

/** Defers the interactive highlighter until an authored code block renders. */
const LazyCodeBlockMdx = lazy(async () => ({
  default: await (() =>
    import("@repo/design-system/components/markdown/code/block").then(
      ({ CodeBlockMdx }) => CodeBlockMdx
    ))(),
}));

export function CodeBlockMdx(props: ComponentProps<typeof LazyCodeBlockMdx>) {
  return (
    <Suspense fallback={null}>
      <LazyCodeBlockMdx {...props} />
    </Suspense>
  );
}
