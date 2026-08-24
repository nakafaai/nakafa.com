import {
  BlockMath,
  InlineMath,
} from "@repo/design-system/components/markdown/math";
import {
  MarkdownCodeBlock,
  MermaidMdx,
} from "@repo/design-system/components/markdown/react/client";
import {
  type ReactMarkdownComponents,
  readMarkdownNodeText,
  sameClassAndNode,
} from "@repo/design-system/components/markdown/react/node";
import { readMermaidMetadata } from "@repo/design-system/lib/markdown/mermaid";
import { cn } from "@repo/design-system/lib/utils";
import { memo } from "react";

const LANGUAGE_REGEX = /language-([^\s]+)/;

export const reactCodeComponents: ReactMarkdownComponents = {
  code: memo(
    ({ node, children, className, ...props }) => {
      const inline = node?.position?.start.line === node?.position?.end.line;
      const isInlineMath = className?.includes("language-math math-inline");

      if (isInlineMath) {
        return (
          <InlineMath data-nakafa="math-inline">{String(children)}</InlineMath>
        );
      }

      if (inline) {
        return (
          <code
            className={cn(
              "inline whitespace-pre-wrap break-all rounded-sm border bg-muted px-1 py-0.5 font-mono text-muted-foreground text-sm tracking-tight",
              className
            )}
            data-nakafa="code-block"
            {...props}
          >
            {children}
          </code>
        );
      }

      const language = className?.match(LANGUAGE_REGEX)?.at(1) ?? "";
      const code = readMarkdownNodeText(node);

      if (language === "math") {
        return (
          <BlockMath
            className={cn("my-4 shadow-none", className)}
            data-nakafa="math-block"
            math={code}
          />
        );
      }

      if (language === "mermaid") {
        const metadata = readMermaidMetadata(node?.data?.meta);

        return (
          <MermaidMdx
            chart={code}
            className={cn("shadow-none", className)}
            description={metadata.description}
            title={metadata.title}
          />
        );
      }

      return (
        <MarkdownCodeBlock
          className={className}
          code={code}
          language={language}
        />
      );
    },
    (previous, next) => sameClassAndNode(previous, next)
  ),
  pre: ({ children }) => children,
};
