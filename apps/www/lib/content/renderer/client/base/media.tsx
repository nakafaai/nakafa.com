"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const MermaidMdx = withHydrationBoundary(
  dynamic(() =>
    import("@repo/design-system/components/markdown/mermaid").then(
      ({ MermaidMdx: Component }) => Component
    )
  )
);

export const Youtube = withHydrationBoundary(
  dynamic(() =>
    import("@repo/design-system/components/markdown/youtube").then(
      ({ Youtube: Component }) => Component
    )
  )
);
