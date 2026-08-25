"use client";

import dynamic from "next/dynamic";

export const MermaidMdx = dynamic(() =>
  import("@repo/design-system/components/markdown/mermaid").then(
    ({ MermaidMdx: Component }) => Component
  )
);

export const Youtube = dynamic(() =>
  import("@repo/design-system/components/markdown/youtube").then(
    ({ Youtube: Component }) => Component
  )
);
