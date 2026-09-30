"use client";

import { CodeBlockText } from "@repo/design-system/components/code-block/text";
import { DiagramFrame } from "@repo/design-system/components/markdown/diagram";
import { CodeFence } from "@repo/design-system/components/markdown/react/fence";
import {
  codeFenceBodyVariants,
  codeFencePreVariants,
} from "@repo/design-system/components/markdown/react/variants";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "cn";
import dynamic from "next/dynamic";
import { type ComponentProps, Suspense } from "react";

const LazyMarkdownCodeBlock = dynamic(() =>
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
 * Defers syntax highlighting until a rendered response contains code. The
 * block's frame and its code as plain text hold its place while the
 * highlighter loads, so the answer never falls back to the page's loading
 * state and nothing around the block moves.
 */
export function MarkdownCodeBlock(
  props: ComponentProps<typeof LazyMarkdownCodeBlock>
) {
  return (
    <Suspense
      fallback={
        <CodeFence language={props.language}>
          <CodeBlockText
            className={cn(codeFenceBodyVariants(), props.className)}
            preClassName={codeFencePreVariants()}
          >
            {props.code}
          </CodeBlockText>
        </CodeFence>
      }
    >
      <LazyMarkdownCodeBlock {...props} />
    </Suspense>
  );
}

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
