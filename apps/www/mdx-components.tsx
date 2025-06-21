import { buttonVariants } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { cn, filterWhitespaceNodes } from "@repo/design-system/lib/utils";
import { Code } from "@repo/design-system/markdown/code";
import { Heading } from "@repo/design-system/markdown/heading";
import { BlockMath, InlineMath } from "@repo/design-system/markdown/math";
import { Paragraph } from "@repo/design-system/markdown/paragraph";
import type {
  AnchorProps,
  BlockquoteProps,
  EmProps,
  HeadingProps,
  ListItemProps,
  ListProps,
  ParagraphProps,
  PreProps,
  StrongProps,
  TableBodyProps,
  TableCellProps,
  TableHeadProps,
  TableHeaderProps,
  TableProps,
  TableRowProps,
} from "@repo/design-system/types/markdown";
import type { MDXComponents } from "mdx/types";

const components = {
  h1: (props: HeadingProps) => (
    <Heading Tag="h1" className="text-3xl" {...props} />
  ),
  h2: (props: HeadingProps) => (
    <Heading Tag="h2" className="text-2xl" {...props} />
  ),
  h3: (props: HeadingProps) => (
    <Heading Tag="h3" className="text-xl" {...props} />
  ),
  h4: (props: HeadingProps) => (
    <Heading Tag="h4" className="text-lg" {...props} />
  ),
  h5: (props: HeadingProps) => (
    <Heading Tag="h5" className="text-base" {...props} />
  ),
  h6: (props: HeadingProps) => (
    <Heading Tag="h6" className="text-sm" {...props} />
  ),
  p: (props: ParagraphProps) => <Paragraph {...props} />,
  ol: (props: ListProps) => (
    <ol className="list-decimal space-y-4 pl-5" {...props} />
  ),
  ul: (props: ListProps) => (
    <ul className="list-disc space-y-4 pl-5" {...props} />
  ),
  li: (props: ListItemProps) => (
    <li className="mt-4 pl-1 text-foreground/80 leading-relaxed" {...props} />
  ),
  em: (props: EmProps) => (
    <em className="font-medium text-foreground" {...props} />
  ),
  strong: (props: StrongProps) => (
    <strong className="font-medium text-foreground" {...props} />
  ),
  blockquote: (props: BlockquoteProps) => (
    <blockquote className="mt-6 border-l-2 pl-4 italic" {...props} />
  ),
  a: ({ href, children, ...props }: AnchorProps) => {
    const className = buttonVariants({ variant: "link" });
    if (href?.startsWith("/")) {
      return (
        <NavigationLink
          href={href}
          title={href}
          className={cn(
            className,
            "h-auto p-0 text-base underline underline-offset-4"
          )}
          {...props}
        >
          {children}
        </NavigationLink>
      );
    }
    if (href?.startsWith("#")) {
      return (
        <a href={href} title={href} className={className} {...props}>
          {children}
        </a>
      );
    }
    return (
      <a
        href={href}
        title={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        {...props}
      >
        {children}
      </a>
    );
  },
  pre: (props: PreProps) => (
    <pre className="whitespace-pre md:whitespace-pre-wrap" {...props} />
  ),
  code: Code,
  InlineMath,
  BlockMath,
  table: ({ children, ...props }: TableProps) => (
    <Table containerClassName="my-4 rounded-xl border shadow-sm" {...props}>
      {filterWhitespaceNodes(children)}
    </Table>
  ),
  thead: ({ children, ...props }: TableHeaderProps) => (
    <TableHeader className="border-b bg-muted/50" {...props}>
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
};

export function useMDXComponents(inherited: MDXComponents): MDXComponents {
  return {
    ...inherited,
    ...components,
  };
}
