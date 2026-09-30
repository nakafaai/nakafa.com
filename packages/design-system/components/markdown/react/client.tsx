"use client";

import { DiagramFrame } from "@repo/design-system/components/markdown/diagram";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import dynamic from "next/dynamic";
import { type ComponentProps, Suspense } from "react";

/** Defers syntax highlighting until a rendered response contains code. */
export const MarkdownCodeBlock = dynamic(() =>
  import("@repo/design-system/components/markdown/react/block").then(
    ({ MarkdownCodeBlock }) => MarkdownCodeBlock
  )
);

const LazyMermaidMdx = dynamic(() =>
  import("@repo/design-system/components/markdown/mermaid").then(
    ({ MermaidMdx }) => MermaidMdx
  )
);

/**
 * Defers Mermaid until a rendered response contains a diagram. The card's
 * frame holds its place while the code loads, so the answer never falls back
 * to the page's loading state and nothing around the card moves.
 */
export function MermaidMdx(props: ComponentProps<typeof LazyMermaidMdx>) {
  return (
    <Suspense
      fallback={
        <DiagramFrame className={props.className} title={props.title}>
          <Spinner className="m-auto" />
        </DiagramFrame>
      }
    >
      <LazyMermaidMdx {...props} />
    </Suspense>
  );
}
