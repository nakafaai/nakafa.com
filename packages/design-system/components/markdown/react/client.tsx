"use client";

import dynamic from "next/dynamic";

/** Defers syntax highlighting until a rendered response contains code. */
export const MarkdownCodeBlock = dynamic(() =>
  import("@repo/design-system/components/markdown/react/block").then(
    ({ MarkdownCodeBlock }) => MarkdownCodeBlock
  )
);

/** Defers Mermaid until a rendered response contains a diagram. */
export const MermaidMdx = dynamic(() =>
  import("@repo/design-system/components/markdown/mermaid").then(
    ({ MermaidMdx }) => MermaidMdx
  )
);
