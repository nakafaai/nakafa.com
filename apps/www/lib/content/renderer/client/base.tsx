"use client";

import dynamic from "next/dynamic";

/** Client-owned boundaries keep optional base renderers out of route entry JS. */
export const LazyCodeBlockMdx = dynamic(() =>
  import("@repo/design-system/components/markdown/code-block").then(
    ({ CodeBlockMdx }) => CodeBlockMdx
  )
);

export const LazyMermaidMdx = dynamic(() =>
  import("@repo/design-system/components/markdown/mermaid").then(
    ({ MermaidMdx }) => MermaidMdx
  )
);
