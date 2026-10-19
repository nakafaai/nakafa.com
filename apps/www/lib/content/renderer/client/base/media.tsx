"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const MermaidMdx = withHydrationBoundary(
  lazyComponent(() =>
    import("@repo/design-system/components/markdown/mermaid").then(
      ({ MermaidMdx: Component }) => Component
    )
  )
);

export const Youtube = withHydrationBoundary(
  lazyComponent(() =>
    import("@repo/design-system/components/markdown/youtube").then(
      ({ Youtube: Component }) => Component
    )
  )
);
