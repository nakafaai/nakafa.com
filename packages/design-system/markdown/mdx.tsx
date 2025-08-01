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
import { CodeBlockMdx } from "@repo/design-system/markdown/code-block";
import { Heading } from "@repo/design-system/markdown/heading";
import {
  BlockMath,
  InlineMath,
  MathContainer,
} from "@repo/design-system/markdown/math";
import { Mermaid } from "@repo/design-system/markdown/mermaid";
import { Paragraph } from "@repo/design-system/markdown/paragraph";
import { Youtube } from "@repo/design-system/markdown/youtube";
import type {
  BlockquoteProps,
  CodeProps,
  EmProps,
  HeadingProps,
  ListItemProps,
  ListProps,
  ParagraphProps,
  PreProps,
  StrongProps,
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
  p: (props: ParagraphProps) => (
    <Paragraph className="text-foreground/80" {...props} />
  ),
  ol: (props: ListProps) => (
    <ol className="my-4 list-decimal pl-5" {...props} />
  ),
  ul: (props: ListProps) => <ul className="my-4 list-disc pl-5" {...props} />,
  li: (props: ListItemProps) => (
    <li
      className="my-2 text-pretty pl-1 text-foreground/80 leading-[1.75]"
      {...props}
    />
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
  Mermaid,
  MathContainer,
  InlineMath,
  BlockMath,
  table: ({ children, ...props }: TableProps) => (
    <Table containerClassName="my-4 rounded-xl border shadow-sm" {...props}>
      {filterWhitespaceNodes(children)}
    </Table>
  ),
  thead: ({ children, ...props }: TableHeaderProps) => (
    <TableHeader
      className="border-b bg-accent text-accent-foreground"
      {...props}
    >
      {filterWhitespaceNodes(children)}
    </TableHeader>
  ),
  tbody: ({ children, ...props }: TableBodyProps) => (
    <TableBody {...props}>{filterWhitespaceNodes(children)}</TableBody>
  ),
  tr: ({ children, ...props }: TableRowProps) => (
    <TableRow className="border-b last:border-b-0" {...props}>
      {filterWhitespaceNodes(children)}
    </TableRow>
  ),
  th: ({ children, ...props }: TableHeadProps) => (
    <TableHead
      className="border-r text-center font-medium last:border-r-0"
      {...props}
    >
      {filterWhitespaceNodes(children)}
    </TableHead>
  ),
  td: ({ children, ...props }: TableCellProps) => (
    <TableCell className="border-r text-center last:border-r-0" {...props}>
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
};
