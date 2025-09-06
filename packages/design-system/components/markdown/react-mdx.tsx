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
import { Mermaid } from "./mermaid";

const LANGUAGE_REGEX = /language-([^\s]+)/;

// Types for markdown component props with `node.position` info
type MarkdownPoint = { line?: number; column?: number };
type MarkdownPosition = { start?: MarkdownPoint; end?: MarkdownPoint };
type MarkdownNode = {
  position?: MarkdownPosition;
  properties?: { className?: string };
};

function sameNodePosition(a?: MarkdownNode, b?: MarkdownNode) {
  const as = a?.position?.start;
  const ae = a?.position?.end;
  const bs = b?.position?.start;
  const be = b?.position?.end;
  return (
    as?.line === bs?.line &&
    as?.column === bs?.column &&
    ae?.line === be?.line &&
    ae?.column === be?.column
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
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
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
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
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
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
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
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
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
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
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
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  p: memo(
    ({ ...props }) => <Paragraph data-nakafa="paragraph" {...props} />,
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  ol: memo(
    ({ ...props }) => (
      <ol
        className="my-4 list-decimal space-y-4 pl-6 last:mb-0"
        data-nakafa="ordered-list"
        {...props}
      />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  ul: memo(
    ({ ...props }) => (
      <ul
        className="my-4 list-disc space-y-4 pl-6 last:mb-0"
        data-nakafa="unordered-list"
        {...props}
      />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  li: memo(
    ({ ...props }) => (
      <li
        className="space-y-4 text-pretty pl-1 leading-relaxed"
        data-nakafa="list-item"
        {...props}
      />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  em: memo(
    ({ ...props }) => (
      <em className="font-medium" data-nakafa="italic" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  strong: memo(
    ({ ...props }) => (
      <strong className="font-medium" data-nakafa="bold" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  blockquote: memo(
    ({ ...props }) => (
      <blockquote
        className="my-4 border-l-2 pl-4 italic"
        data-nakafa="quote"
        {...props}
      />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  a: memo(
    ({ ...props }) => <Anchor data-nakafa="anchor" {...props} />,
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  table: memo(
    ({ children, ...props }) => (
      <Table
        containerClassName="my-4 rounded-xl border shadow-sm"
        data-nakafa="table"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </Table>
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  thead: memo(
    ({ children, ...props }) => (
      <TableHeader
        className="border-b bg-accent text-accent-foreground"
        data-nakafa="table-header"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </TableHeader>
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  hr: memo(
    ({ ...props }) => (
      <hr className="my-4 border-border" data-nakafa="hr" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  tbody: memo(
    ({ children, ...props }) => (
      <TableBody data-nakafa="table-body" {...props}>
        {filterWhitespaceNodes(children)}
      </TableBody>
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
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
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
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
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
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
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
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
              className
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
        return <BlockMath data-nakafa="math-block" math={code} />;
      }

      if (language === "mermaid") {
        return (
          <div
            className={cn(
              "group relative my-4 h-auto rounded-xl border p-4",
              className
            )}
            data-nakafa="mermaid-block"
          >
            <div className="flex items-center justify-end">
              <CodeBlockCopyButton code={code} />
            </div>
            <Mermaid chart={code} />
          </div>
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
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
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
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
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
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
};
