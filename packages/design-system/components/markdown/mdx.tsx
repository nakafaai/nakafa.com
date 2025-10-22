import { Anchor } from "@repo/design-system/components/markdown/anchor";
import { CodeBlockMdx } from "@repo/design-system/components/markdown/code-block";
import { Heading } from "@repo/design-system/components/markdown/heading";
import {
  BlockMath,
  InlineMath,
  MathContainer,
} from "@repo/design-system/components/markdown/math";
import { MermaidMdx } from "@repo/design-system/components/markdown/mermaid";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import { Youtube } from "@repo/design-system/components/markdown/youtube";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { cn, filterWhitespaceNodes } from "@repo/design-system/lib/utils";
import type {
  BlockquoteProps,
  CodeProps,
  EmProps,
  HeadingProps,
  ListItemProps,
  ListProps,
  MDXComponents,
  ParagraphProps,
  PreProps,
  StrongProps,
  SubProps,
  SupProps,
  TableBodyProps,
  TableCellProps,
  TableHeaderProps,
  TableHeadProps,
  TableProps,
  TableRowProps,
} from "@repo/design-system/types/markdown";

export const components = {
  h1: (props: HeadingProps) => (
    <Heading className="text-3xl" Tag="h1" {...props} />
  ),
  h2: (props: HeadingProps) => (
    <Heading className="text-2xl" Tag="h2" {...props} />
  ),
  h3: (props: HeadingProps) => (
    <Heading className="text-xl" Tag="h3" {...props} />
  ),
  h4: (props: HeadingProps) => (
    <Heading className="text-lg" Tag="h4" {...props} />
  ),
  h5: (props: HeadingProps) => (
    <Heading className="text-base" Tag="h5" {...props} />
  ),
  h6: (props: HeadingProps) => (
    <Heading className="text-sm" Tag="h6" {...props} />
  ),
  p: (props: ParagraphProps) => <Paragraph {...props} />,
  ol: (props: ListProps) => (
    <ol className="my-4 list-decimal space-y-4 pl-6 last:mb-0" {...props} />
  ),
  ul: (props: ListProps) => (
    <ul className="my-4 list-disc space-y-4 pl-6 last:mb-0" {...props} />
  ),
  li: (props: ListItemProps) => (
    <li className="space-y-4 text-pretty pl-1 leading-relaxed" {...props} />
  ),
  em: (props: EmProps) => <em className="font-medium" {...props} />,
  strong: (props: StrongProps) => <strong className="font-medium" {...props} />,
  blockquote: (props: BlockquoteProps) => (
    <blockquote className="my-4 border-l-2 pl-4 italic" {...props} />
  ),
  a: Anchor,
  CodeBlock: CodeBlockMdx,
  code: (props: CodeProps) => (
    <code
      className="inline break-all rounded-sm border bg-muted px-1 py-0.5 font-mono text-muted-foreground text-sm tracking-tight"
      {...props}
    />
  ),
  Youtube,
  Mermaid: MermaidMdx,
  MathContainer,
  InlineMath,
  BlockMath,
  table: ({ children, ...props }: TableProps) => (
    <Table containerClassName="my-4 rounded-xl border" {...props}>
      {filterWhitespaceNodes(children)}
    </Table>
  ),
  thead: ({ children, ...props }: TableHeaderProps) => (
    <TableHeader className="border-b bg-muted/80" {...props}>
      {filterWhitespaceNodes(children)}
    </TableHeader>
  ),
  tbody: ({ children, ...props }: TableBodyProps) => (
    <TableBody className="bg-muted/40" data-nakafa="table-body" {...props}>
      {filterWhitespaceNodes(children)}
    </TableBody>
  ),
  tr: ({ children, ...props }: TableRowProps) => (
    <TableRow className="border-b last:border-b-0" {...props}>
      {filterWhitespaceNodes(children)}
    </TableRow>
  ),
  th: ({ children, ...props }: TableHeadProps) => (
    <TableHead className="border-r font-medium last:border-r-0" {...props}>
      {filterWhitespaceNodes(children)}
    </TableHead>
  ),
  td: ({ children, ...props }: TableCellProps) => (
    <TableCell className="border-r last:border-r-0" {...props}>
      {filterWhitespaceNodes(children)}
    </TableCell>
  ),
  pre: ({
    node,
    children,
  }: PreProps & { node: { properties: { className: string } } }) => {
    let language = "javascript";
    let filename = "index.js";

    if (typeof node?.properties?.className === "string") {
      language = node.properties.className.replace("language-", "");
      filename = `index.${language}`;
    }

    const hasChildren =
      typeof children === "object" && children !== null && "props" in children;

    if (!hasChildren) {
      return <pre>{children}</pre>;
    }

    const data = [
      {
        language,
        filename,
        code: (children.props as { children: string })?.children ?? "",
      },
    ];

    return <CodeBlockMdx data={data} />;
  },
  sup: ({ children, className, ...props }: SupProps) => (
    <sup className={cn("text-sm", className)} {...props}>
      {children}
    </sup>
  ),
  sub: ({ children, className, ...props }: SubProps) => (
    <sub className={cn("text-sm", className)} {...props}>
      {children}
    </sub>
  ),
} satisfies MDXComponents;
