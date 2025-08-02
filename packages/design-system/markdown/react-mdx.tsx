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
import { BlockMath, InlineMath } from "@repo/design-system/markdown/math";
import { Paragraph } from "@repo/design-system/markdown/paragraph";
import type {
  BlockquoteProps,
  CodeProps,
  EmProps,
  HeadingProps,
  ListItemProps,
  ListProps,
  ParagraphProps,
  StrongProps,
  TableBodyProps,
  TableCellProps,
  TableHeaderProps,
  TableHeadProps,
  TableProps,
  TableRowProps,
} from "@repo/design-system/types/markdown";
import type { Options } from "react-markdown";

export const reactMdxComponents: Options["components"] = {
  h1: (props: HeadingProps) => (
    <Heading className="mt-6 mb-4 text-3xl" Tag="h1" {...props} />
  ),
  h2: (props: HeadingProps) => (
    <Heading className="mt-6 mb-4 text-2xl" Tag="h2" {...props} />
  ),
  h3: (props: HeadingProps) => (
    <Heading className="mt-6 mb-4 text-xl" Tag="h3" {...props} />
  ),
  h4: (props: HeadingProps) => (
    <Heading className="mt-6 mb-4 text-lg" Tag="h4" {...props} />
  ),
  h5: (props: HeadingProps) => (
    <Heading className="mt-6 mb-4 text-base" Tag="h5" {...props} />
  ),
  h6: (props: HeadingProps) => (
    <Heading className="mt-6 mb-4 text-sm" Tag="h6" {...props} />
  ),
  p: (props: ParagraphProps) => (
    <Paragraph className="text-inherit" {...props} />
  ),
  ol: (props: ListProps) => (
    <ol className="my-4 list-decimal pl-5" {...props} />
  ),
  ul: (props: ListProps) => <ul className="my-4 list-disc pl-5" {...props} />,
  li: (props: ListItemProps) => (
    <li className="my-2 text-pretty pl-1 leading-[1.75]" {...props} />
  ),
  em: (props: EmProps) => <em className="font-medium" {...props} />,
  strong: (props: StrongProps) => <strong className="font-medium" {...props} />,
  blockquote: (props: BlockquoteProps) => (
    <blockquote className="my-4 border-l-2 pl-4 italic" {...props} />
  ),
  a: Anchor,
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
  code: ({ children, ...props }: CodeProps) => {
    const isInlineMath = props.className?.includes("language-math math-inline");

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
  pre: ({ node, children }) => {
    let language = "plaintext";
    let filename = "code.txt";

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
          filename = `index.${language}`;
        }
      }
    }

    const hasChildren =
      typeof children === "object" && children !== null && "props" in children;

    if (!hasChildren) {
      return <pre>{children}</pre>;
    }

    const result = (children.props as { children: string })?.children ?? "";

    if (language === "math") {
      return <BlockMath className="my-4">{result}</BlockMath>;
    }

    return (
      <CodeBlockMdx
        data={[
          {
            language,
            filename,
            code: result,
          },
        ]}
      />
    );
  },
};
