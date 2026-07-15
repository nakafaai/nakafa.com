import { CodeBlockMdx } from "@repo/design-system/components/markdown/code-block";
import { Heading } from "@repo/design-system/components/markdown/heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { filterWhitespaceNodes } from "@repo/design-system/lib/markdown/children";
import { cn } from "@repo/design-system/lib/utils";
import type {
  BlockquoteProps,
  CodeProps,
  EmProps,
  HeadingProps,
  ListItemProps,
  ListProps,
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
import { type ComponentPropsWithoutRef, isValidElement } from "react";

type ContentLayoutProps = ComponentPropsWithoutRef<"div">;
type MdxPreProps = PreProps & {
  node: { properties: { className: string } };
};

/** Renders a standard spaced block for visual MDX components. */
export function ContentBlock({
  children,
  className,
  ...props
}: ContentLayoutProps) {
  return (
    <div className={cn("mt-4", className)} {...props}>
      {children}
    </div>
  );
}

/** Renders a vertical stack for related visual MDX components. */
export function ContentStack({
  children,
  className,
  ...props
}: ContentLayoutProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      {children}
    </div>
  );
}

/** Renders a single-column grid for related article visualizations. */
export function ContentGrid({
  children,
  className,
  ...props
}: ContentLayoutProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", className)} {...props}>
      {children}
    </div>
  );
}

/** Renders a level-one MDX heading with Nakafa typography. */
export function MdxHeading1(props: HeadingProps) {
  return <Heading className="text-3xl" Tag="h1" {...props} />;
}

/** Renders a level-two MDX heading with Nakafa typography. */
export function MdxHeading2(props: HeadingProps) {
  return <Heading className="text-2xl" Tag="h2" {...props} />;
}

/** Renders a level-three MDX heading with Nakafa typography. */
export function MdxHeading3(props: HeadingProps) {
  return <Heading className="text-xl" Tag="h3" {...props} />;
}

/** Renders a level-four MDX heading with Nakafa typography. */
export function MdxHeading4(props: HeadingProps) {
  return <Heading className="text-lg" Tag="h4" {...props} />;
}

/** Renders a level-five MDX heading with Nakafa typography. */
export function MdxHeading5(props: HeadingProps) {
  return <Heading className="text-lg" Tag="h5" {...props} />;
}

/** Renders a level-six MDX heading with Nakafa typography. */
export function MdxHeading6(props: HeadingProps) {
  return <Heading className="text-lg" Tag="h6" {...props} />;
}

/** Renders an ordered MDX list with readable vertical rhythm. */
export function MdxOrderedList(props: ListProps) {
  return (
    <ol className="my-4 list-decimal space-y-4 pl-4.5 last:mb-0" {...props} />
  );
}

/** Renders an unordered MDX list with readable vertical rhythm. */
export function MdxUnorderedList(props: ListProps) {
  return (
    <ul className="my-4 list-disc space-y-4 pl-4.5 last:mb-0" {...props} />
  );
}

/** Renders one MDX list item with consistent prose spacing. */
export function MdxListItem(props: ListItemProps) {
  return (
    <li className="space-y-4 text-pretty pl-1 leading-relaxed" {...props} />
  );
}

/** Renders emphasized MDX text at the shared medium weight. */
export function MdxEmphasis(props: EmProps) {
  return <em className="font-medium" {...props} />;
}

/** Renders strong MDX text at the shared medium weight. */
export function MdxStrong(props: StrongProps) {
  return <strong className="font-medium" {...props} />;
}

/** Renders an MDX quotation with the shared callout treatment. */
export function MdxBlockquote(props: BlockquoteProps) {
  return (
    <blockquote
      className="my-4 rounded-r-xl border-foreground border-l-2 bg-muted p-4 italic"
      {...props}
    />
  );
}

/** Renders inline MDX code without changing block-code behavior. */
export function MdxCode(props: CodeProps) {
  return (
    <code
      className="inline whitespace-pre-wrap break-all rounded-sm border bg-muted px-1 py-0.5 font-mono text-muted-foreground text-sm tracking-tight"
      {...props}
    />
  );
}

/** Renders an MDX table and removes compiler-only whitespace nodes. */
export function MdxTable({ children, className, ...props }: TableProps) {
  return (
    <Table
      className={cn("has-[tbody]:[&_thead]:border-b", className)}
      containerClassName="content-auto-table my-4 rounded-xl border"
      {...props}
    >
      {filterWhitespaceNodes(children)}
    </Table>
  );
}

/** Renders an MDX table header with the shared muted surface. */
export function MdxTableHeader({ children, ...props }: TableHeaderProps) {
  return (
    <TableHeader className="bg-muted/80" {...props}>
      {filterWhitespaceNodes(children)}
    </TableHeader>
  );
}

/** Renders an MDX table body with the shared muted surface. */
export function MdxTableBody({ children, ...props }: TableBodyProps) {
  return (
    <TableBody className="bg-muted/40" data-nakafa="table-body" {...props}>
      {filterWhitespaceNodes(children)}
    </TableBody>
  );
}

/** Renders one MDX table row with a terminal-border exception. */
export function MdxTableRow({ children, ...props }: TableRowProps) {
  return (
    <TableRow className="border-b last:border-b-0" {...props}>
      {filterWhitespaceNodes(children)}
    </TableRow>
  );
}

/** Renders one MDX table heading cell with column separation. */
export function MdxTableHead({ children, ...props }: TableHeadProps) {
  return (
    <TableHead className="border-r font-medium last:border-r-0" {...props}>
      {filterWhitespaceNodes(children)}
    </TableHead>
  );
}

/** Renders one MDX table data cell with column separation. */
export function MdxTableCell({ children, ...props }: TableCellProps) {
  return (
    <TableCell className="border-r last:border-r-0" {...props}>
      {filterWhitespaceNodes(children)}
    </TableCell>
  );
}

/** Adapts fenced MDX code into the shared highlighted code-block model. */
export function MdxPre({ node, children }: MdxPreProps) {
  let language = "javascript";
  let filename = "index.js";

  if (typeof node?.properties?.className === "string") {
    language = node.properties.className.replace("language-", "");
    filename = `index.${language}`;
  }

  if (!isValidElement<{ children?: unknown }>(children)) {
    return <pre>{children}</pre>;
  }

  const code = children.props.children;
  if (typeof code !== "string") {
    return <pre>{children}</pre>;
  }

  const data = [
    {
      language,
      filename,
      code,
    },
  ];

  return <CodeBlockMdx data={data} />;
}

/** Renders superscript MDX text at the shared annotation size. */
export function MdxSuperscript({ children, className, ...props }: SupProps) {
  return (
    <sup className={cn("text-sm", className)} {...props}>
      {children}
    </sup>
  );
}

/** Renders subscript MDX text at the shared annotation size. */
export function MdxSubscript({ children, className, ...props }: SubProps) {
  return (
    <sub className={cn("text-sm", className)} {...props}>
      {children}
    </sub>
  );
}
