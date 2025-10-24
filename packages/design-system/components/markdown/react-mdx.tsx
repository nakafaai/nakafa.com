import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
} from "@repo/design-system/components/ai/code-block";
import { Anchor } from "@repo/design-system/components/markdown/anchor";
import { Heading } from "@repo/design-system/components/markdown/heading";
import {
  BlockMath,
  InlineMath,
} from "@repo/design-system/components/markdown/math";
import { MermaidMdx } from "@repo/design-system/components/markdown/mermaid";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { cn, filterWhitespaceNodes } from "@repo/design-system/lib/utils";
import { isValidElement, memo } from "react";
import type { Options } from "react-markdown";
import type { BundledLanguage } from "shiki";

const LANGUAGE_REGEX = /language-([^\s]+)/;

type MarkdownPoint = { line?: number; column?: number };
type MarkdownPosition = { start?: MarkdownPoint; end?: MarkdownPoint };
type MarkdownNode = {
  position?: MarkdownPosition;
  properties?: { className?: string };
};

function sameNodePosition(prev?: MarkdownNode, next?: MarkdownNode): boolean {
  if (!(prev?.position || next?.position)) {
    return true;
  }
  if (!(prev?.position && next?.position)) {
    return false;
  }

  const prevStart = prev.position.start;
  const nextStart = next.position.start;
  const prevEnd = prev.position.end;
  const nextEnd = next.position.end;

  return (
    prevStart?.line === nextStart?.line &&
    prevStart?.column === nextStart?.column &&
    prevEnd?.line === nextEnd?.line &&
    prevEnd?.column === nextEnd?.column
  );
}

// Shared comparators
function sameClassAndNode(
  prev: { className?: string; node?: MarkdownNode },
  next: { className?: string; node?: MarkdownNode },
) {
  return (
    prev.className === next.className && sameNodePosition(prev.node, next.node)
  );
}

export const reactMdxComponents: Options["components"] = {
  h1: memo(
    ({ ...props }) => (
      <Heading
        className="mt-6 mb-4 text-2xl"
        data-nakafa="heading-1"
        Tag="h1"
        {...props}
        enableLink={false}
      />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  h2: memo(
    ({ ...props }) => (
      <Heading
        className="mt-6 mb-4 text-xl"
        data-nakafa="heading-2"
        Tag="h2"
        {...props}
        enableLink={false}
      />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  h3: memo(
    ({ ...props }) => (
      <Heading
        className="mt-6 mb-4 text-lg"
        data-nakafa="heading-3"
        Tag="h3"
        {...props}
        enableLink={false}
      />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  h4: memo(
    ({ ...props }) => (
      <Heading
        className="mt-6 mb-4 text-base"
        data-nakafa="heading-4"
        Tag="h4"
        {...props}
        enableLink={false}
      />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  h5: memo(
    ({ ...props }) => (
      <Heading
        className="mt-6 mb-4 text-sm"
        data-nakafa="heading-5"
        Tag="h5"
        {...props}
        enableLink={false}
      />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  h6: memo(
    ({ ...props }) => (
      <Heading
        className="mt-6 mb-4 text-xs"
        data-nakafa="heading-6"
        Tag="h6"
        {...props}
        enableLink={false}
      />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  p: memo(
    ({ ...props }) => <Paragraph data-nakafa="paragraph" {...props} />,
    (p, n) => sameClassAndNode(p, n),
  ),
  ol: memo(
    ({ ...props }) => (
      <ol
        className="my-4 list-decimal space-y-4 pl-6 last:mb-0"
        data-nakafa="ordered-list"
        {...props}
      />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  ul: memo(
    ({ ...props }) => (
      <ul
        className="my-4 list-disc space-y-4 pl-6 last:mb-0"
        data-nakafa="unordered-list"
        {...props}
      />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  li: memo(
    ({ ...props }) => (
      <li
        className="space-y-4 text-pretty pl-1 leading-relaxed"
        data-nakafa="list-item"
        {...props}
      />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  em: memo(
    ({ ...props }) => (
      <em className="font-medium" data-nakafa="italic" {...props} />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  strong: memo(
    ({ ...props }) => (
      <strong className="font-medium" data-nakafa="bold" {...props} />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  blockquote: memo(
    ({ ...props }) => (
      <blockquote
        className="my-4 border-l-2 pl-4 italic"
        data-nakafa="quote"
        {...props}
      />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  a: memo(
    ({ ...props }) => <Anchor data-nakafa="anchor" {...props} />,
    (p, n) => sameClassAndNode(p, n),
  ),
  table: memo(
    ({ children, ...props }) => (
      <Table
        containerClassName="my-4 rounded-xl border"
        data-nakafa="table"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </Table>
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  thead: memo(
    ({ children, ...props }) => (
      <TableHeader
        className="border-b bg-muted/80"
        data-nakafa="table-header"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </TableHeader>
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  hr: memo(
    ({ ...props }) => (
      <hr className="my-4 border-border" data-nakafa="hr" {...props} />
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  tbody: memo(
    ({ children, ...props }) => (
      <TableBody className="bg-muted/40" data-nakafa="table-body" {...props}>
        {filterWhitespaceNodes(children)}
      </TableBody>
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  tr: memo(
    ({ children, ...props }) => (
      <TableRow
        className="border-b last:border-b-0"
        data-nakafa="table-row"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </TableRow>
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  th: memo(
    ({ children, ...props }) => (
      <TableHead
        className="border-r font-medium last:border-r-0"
        data-nakafa="table-head"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </TableHead>
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  td: memo(
    ({ children, ...props }) => (
      <TableCell
        className="border-r last:border-r-0"
        data-nakafa="table-cell"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </TableCell>
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
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
              "inline break-all rounded-sm border bg-muted px-1 py-0.5 font-mono text-muted-foreground text-sm tracking-tight",
              className,
            )}
            data-nakafa="code-block"
            {...props}
          >
            {children}
          </code>
        );
      }

      const match = className?.match(LANGUAGE_REGEX);
      const language = (match?.at(1) ?? "") as BundledLanguage | "math";

      // Extract code content from children safely
      let code = "";
      if (
        isValidElement(children) &&
        children.props &&
        typeof children.props === "object" &&
        "children" in children.props &&
        typeof children.props.children === "string"
      ) {
        code = children.props.children;
      } else if (typeof children === "string") {
        code = children;
      }

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
        return (
          <MermaidMdx chart={code} className={`shadow-none ${className}`} />
        );
      }

      return (
        <CodeBlock
          className={cn("overflow-x-auto border-t", className)}
          code={code}
          data-language={language}
          data-nakafa="code-block"
          language={language}
          preClassName="overflow-x-auto font-mono text-sm p-4 bg-muted/40"
        >
          <CodeBlockDownloadButton code={code} language={language} />
          <CodeBlockCopyButton />
        </CodeBlock>
      );
    },
    (p, n) => sameClassAndNode(p, n),
  ),
  pre: ({ children }) => children,
  sup: memo(
    ({ node, children, className, ...props }) => (
      <sup
        className={cn("text-sm", className)}
        data-nakafa="superscript"
        {...props}
      >
        {children}
      </sup>
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
  sub: memo(
    ({ node, children, className, ...props }) => (
      <sub
        className={cn("text-sm", className)}
        data-nakafa="subscript"
        {...props}
      >
        {children}
      </sub>
    ),
    (p, n) => sameClassAndNode(p, n),
  ),
};
