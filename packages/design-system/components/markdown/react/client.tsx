"use client";

import { CodeBlockText } from "@repo/design-system/components/code-block/text";
import { DiagramFrame } from "@repo/design-system/components/markdown/diagram";
import { CodeFence } from "@repo/design-system/components/markdown/react/fence";
import {
  FenceSourceContext,
  useFenceSource,
} from "@repo/design-system/components/markdown/react/source";
import {
  codeFenceBodyVariants,
  codeFencePreVariants,
} from "@repo/design-system/components/markdown/react/variants";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "cn";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
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

interface MarkdownCodeBlockProps {
  readonly className?: string | undefined;
  readonly code: string;
  readonly language: string;
}

/**
 * The block's frame and its code as plain text. It holds the place of the
 * highlighted block while the highlighter loads.
 */
function CodeBlockPlaceholder() {
  const { className, code, language } = useFenceSource();

  return (
    <CodeFence language={language}>
      <CodeBlockText
        className={cn(codeFenceBodyVariants(), className)}
        preClassName={codeFencePreVariants()}
      >
        {code}
      </CodeBlockText>
    </CodeFence>
  );
}

/**
 * Defers syntax highlighting until a rendered response contains code. The
 * block's frame and its code as plain text hold its place while the
 * highlighter loads, so the answer never falls back to the page's loading
 * state and nothing around the block moves.
 */
export function MarkdownCodeBlock({
  className,
  code,
  language,
}: MarkdownCodeBlockProps) {
  return (
    <FenceSourceContext value={{ className, code, language }}>
      <Suspense fallback={<CodeBlockPlaceholder />}>
        <LazyMarkdownCodeBlock />
      </Suspense>
    </FenceSourceContext>
  );
}

/**
 * Defers Mermaid until a rendered response contains a diagram. The card's
 * frame holds its place while the code loads, so the answer never falls back
 * to the page's loading state and nothing around the card moves. A diagram
 * the model gave no title or description takes the words of the reader's
 * language, in the frame and in the card alike.
 */
export function MermaidMdx({
  description,
  title,
  ...props
}: Omit<ComponentProps<typeof LazyMermaidMdx>, "description" | "title"> & {
  description: string | undefined;
  title: string | undefined;
}) {
  const t = useTranslations("Ai");
  const tCommon = useTranslations("Common");
  const heading = title ?? t("diagram-title");

  return (
    <Suspense
      fallback={
        <DiagramFrame className={props.className} title={heading}>
          <Spinner className="m-auto" label={tCommon("loading")} />
        </DiagramFrame>
      }
    >
      <LazyMermaidMdx
        {...props}
        description={description ?? t("diagram-description")}
        title={heading}
      />
    </Suspense>
  );
}
