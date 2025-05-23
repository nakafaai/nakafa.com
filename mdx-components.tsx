import { BlockMath, InlineMath, type MathComponentProps } from "react-katex";
import { codeToHtml, createCssVariablesTheme } from "shiki";
import { Heading } from "./components/markdown/heading";
import { Paragraph } from "./components/markdown/paragraph";
import { buttonVariants } from "./components/ui/button";
import NavigationLink from "./components/ui/navigation-link";
import { ScrollArea, ScrollBar } from "./components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";
import { cn } from "./lib/utils";
import { filterWhitespaceNodes } from "./lib/utils/markdown";
import type {
  AnchorProps,
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
  TableHeadProps,
  TableHeaderProps,
  TableProps,
  TableRowProps,
} from "./types/markdown";

const CONSTANTS = {
  CODE_REGEX: /language-/,
};

const cssVariablesTheme = createCssVariablesTheme({});

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
  code: async (props: CodeProps) => {
    if (typeof props.children === "string") {
      const lang = props.className?.replace(CONSTANTS.CODE_REGEX, "") || "jsx";

      const code = await codeToHtml(props.children, {
        lang,
        theme: cssVariablesTheme,
        transformers: [
          {
            // Since we're using dangerouslySetInnerHTML, the code and pre
            // tags should be removed.
            pre: (hast) => {
              if (hast.children.length !== 1) {
                throw new Error("<pre>: Expected a single <code> child");
              }
              if (hast.children[0].type !== "element") {
                throw new Error("<pre>: Expected a <code> child");
              }
              return hast.children[0];
            },
            postprocess(html) {
              return html.replace(/^<code>|<\/code>$/g, "");
            },
          },
        ],
      });

      return (
        <code
          className="inline text-xs sm:text-sm"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: We're using shiki to render the code
          dangerouslySetInnerHTML={{ __html: code }}
        />
      );
    }

    return <code className="inline" {...props} />;
  },
  InlineMath,
  BlockMath: (props: MathComponentProps) => (
    <ScrollArea
      className="max-w-full rounded-xl border bg-card text-card-foreground shadow-sm"
      type="hover"
    >
      <div className="px-4">
        <BlockMath {...props} />
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
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

declare global {
  type MDXProvidedComponents = typeof components;
}

export function useMDXComponents(): MDXProvidedComponents {
  return components;
}
