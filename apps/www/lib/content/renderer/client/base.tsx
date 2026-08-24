"use client";

import dynamic from "next/dynamic";

/** Client-owned boundaries keep optional base renderers out of route entry JS. */
export const LazyMermaidMdx = dynamic(() =>
  import("@repo/design-system/components/markdown/mermaid").then(
    ({ MermaidMdx }) => MermaidMdx
  )
);
