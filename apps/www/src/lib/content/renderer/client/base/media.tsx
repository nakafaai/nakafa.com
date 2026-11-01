"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const MermaidMdx = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/markdown/mermaid").then(
      (module) => ({ default: module.MermaidMdx })
    )
  )
);

export const Youtube = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/markdown/youtube").then(
      (module) => ({ default: module.Youtube })
    )
  )
);
