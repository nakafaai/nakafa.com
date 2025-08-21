import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { filterWhitespaceNodes } from "@repo/design-system/lib/utils";
import { Anchor } from "@repo/design-system/markdown/anchor";
import { Heading } from "@repo/design-system/markdown/heading";
import { BlockMath, InlineMath } from "@repo/design-system/markdown/math";
import { Paragraph } from "@repo/design-system/markdown/paragraph";
import { memo } from "react";
import type { Options } from "react-markdown";
import { CodeBlock, CodeBlockCopyButton } from "../components/ai/code-block";

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
      <Heading className="mt-6 mb-4 text-2xl" Tag="h1" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  h2: memo(
    ({ ...props }) => (
      <Heading className="mt-6 mb-4 text-xl" Tag="h2" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  h3: memo(
    ({ ...props }) => (
      <Heading className="mt-6 mb-4 text-lg" Tag="h3" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  h4: memo(
    ({ ...props }) => (
      <Heading className="mt-6 mb-4 text-base" Tag="h4" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  h5: memo(
    ({ ...props }) => (
      <Heading className="mt-6 mb-4 text-sm" Tag="h5" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  h6: memo(
    ({ ...props }) => (
      <Heading className="mt-6 mb-4 text-xs" Tag="h6" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  p: memo(
    ({ ...props }) => <Paragraph className="text-inherit" {...props} />,
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  ol: memo(
    ({ ...props }) => (
      <ol className="my-4 list-decimal space-y-4 pl-6 last:mb-0" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  ul: memo(
    ({ ...props }) => (
      <ul className="my-4 list-disc space-y-4 pl-6 last:mb-0" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  li: memo(
    ({ ...props }) => (
      <li className="space-y-4 text-pretty pl-1 leading-relaxed" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  em: memo(
    ({ ...props }) => <em className="font-medium" {...props} />,
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  strong: memo(
    ({ ...props }) => <strong className="font-medium" {...props} />,
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  blockquote: memo(
    ({ ...props }) => (
      <blockquote className="my-4 border-l-2 pl-4 italic" {...props} />
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  a: Anchor,
  table: memo(
    ({ children, ...props }) => (
      <Table containerClassName="my-4 rounded-xl border shadow-sm" {...props}>
        {filterWhitespaceNodes(children)}
      </Table>
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  thead: memo(
    ({ children, ...props }) => (
      <TableHeader
        className="border-b bg-accent text-accent-foreground"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </TableHeader>
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  hr: memo(
    ({ ...props }) => <hr className="my-4 border-border" {...props} />,
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  tbody: memo(
    ({ children, ...props }) => (
      <TableBody {...props}>{filterWhitespaceNodes(children)}</TableBody>
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  tr: memo(
    ({ children, ...props }) => (
      <TableRow className="border-b last:border-b-0" {...props}>
        {filterWhitespaceNodes(children)}
      </TableRow>
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  th: memo(
    ({ children, ...props }) => (
      <TableHead className="border-r font-medium last:border-r-0" {...props}>
        {filterWhitespaceNodes(children)}
      </TableHead>
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  td: memo(
    ({ children, ...props }) => (
      <TableCell className="border-r last:border-r-0" {...props}>
        {filterWhitespaceNodes(children)}
      </TableCell>
    ),
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  code: memo(
    ({ children, ...props }) => {
      const isInlineMath = props.className?.includes(
        "language-math math-inline"
      );

      if (isInlineMath) {
        return <InlineMath>{String(children)}</InlineMath>;
      }

      return (
        <code
          className="inline break-all rounded-sm border bg-muted px-1 py-0.5 font-mono text-muted-foreground text-sm tracking-tight"
          {...props}
        >
          {children}
        </code>
      );
    },
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
  pre: memo(
    ({ node, children }) => {
      let language = "plaintext";

      const codeElement = node?.children.find(
        (child) => child.type === "element" && child.tagName === "code"
      );

      if (codeElement?.type === "element") {
        const classNameList = codeElement.properties?.className;

        if (Array.isArray(classNameList)) {
          const langClass = classNameList.find(
            (c) => typeof c === "string" && c.startsWith("language-")
          );

          if (typeof langClass === "string") {
            language = langClass.replace("language-", "");
          }
        }
      }

      const hasChildren =
        typeof children === "object" &&
        children !== null &&
        "props" in children;

      if (!hasChildren) {
        return <pre>{children}</pre>;
      }

      const result = (children.props as { children: string })?.children ?? "";

      if (language === "math") {
        return <BlockMath className="my-4">{result}</BlockMath>;
      }

      return (
        <CodeBlock code={result} language={language}>
          <CodeBlockCopyButton />
        </CodeBlock>
      );
    },
    (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
  ),
};
