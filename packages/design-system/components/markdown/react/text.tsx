import { Anchor } from "@repo/design-system/components/markdown/anchor";
import { Heading } from "@repo/design-system/components/markdown/heading";
import { MarkdownImage } from "@repo/design-system/components/markdown/image";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import type { ReactMarkdownComponents } from "@repo/design-system/components/markdown/react/node";
import { emphasisVariants } from "@repo/design-system/lib/markdown/emphasis";
import { quoteVariants } from "@repo/design-system/lib/prose";
import { cn } from "cn";

/**
 * The text blocks of a Markdown response take the direction of their own text.
 * `rehypeDirection` marks them, so no element here sets a `dir`.
 *
 * A list item owns the room for its marker: its margin on its start side. An
 * item in Arabic keeps that room on the right and its neighbour in Latin on
 * the left. The item sets `text-start` itself, because WebKit aligns the text
 * of a list item with the direction of its list and not its own.
 */
export const reactTextComponents: ReactMarkdownComponents = {
  a: ({ node: _node, ...props }) => <Anchor data-nakafa="anchor" {...props} />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className={quoteVariants()} data-nakafa="quote" {...props} />
  ),
  em: ({ node: _node, ...props }) => <em data-nakafa="italic" {...props} />,
  h1: ({ node: _node, ...props }) => (
    <Heading
      className="mt-6 mb-4 text-2xl"
      data-nakafa="heading-1"
      Tag="h1"
      {...props}
      enableLink={false}
    />
  ),
  h2: ({ node: _node, ...props }) => (
    <Heading
      className="mt-6 mb-4 text-xl"
      data-nakafa="heading-2"
      Tag="h2"
      {...props}
      enableLink={false}
    />
  ),
  h3: ({ node: _node, ...props }) => (
    <Heading
      className="mt-6 mb-4 text-lg"
      data-nakafa="heading-3"
      Tag="h3"
      {...props}
      enableLink={false}
    />
  ),
  h4: ({ node: _node, ...props }) => (
    <Heading
      className="mt-6 mb-4 text-base"
      data-nakafa="heading-4"
      Tag="h4"
      {...props}
      enableLink={false}
    />
  ),
  h5: ({ node: _node, ...props }) => (
    <Heading
      className="mt-6 mb-4 text-base"
      data-nakafa="heading-5"
      Tag="h5"
      {...props}
      enableLink={false}
    />
  ),
  h6: ({ node: _node, ...props }) => (
    <Heading
      className="mt-6 mb-4 text-base"
      data-nakafa="heading-6"
      Tag="h6"
      {...props}
      enableLink={false}
    />
  ),
  hr: ({ node: _node, ...props }) => (
    <hr className="my-4 border-border" data-nakafa="hr" {...props} />
  ),
  img: ({ node: _node, ...props }) => (
    <MarkdownImage data-nakafa="image" {...props} />
  ),
  li: ({ node: _node, ...props }) => (
    <li
      className="ms-8 text-pretty ps-1 text-start leading-relaxed [&>*+*]:mt-4 [&>p:first-child]:inline"
      data-nakafa="list-item"
      {...props}
    />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol
      className="my-4 list-decimal space-y-4 last:mb-0"
      data-nakafa="ordered-list"
      {...props}
    />
  ),
  p: ({ node: _node, ...props }) => (
    <Paragraph data-nakafa="paragraph" {...props} />
  ),
  strong: ({ className, node: _node, ...props }) => (
    <strong
      className={emphasisVariants({ className })}
      data-nakafa="bold"
      {...props}
    />
  ),
  sub: ({ children, className, node: _node, ...props }) => (
    <sub
      className={cn("text-sm", className)}
      data-nakafa="subscript"
      {...props}
    >
      {children}
    </sub>
  ),
  sup: ({ children, className, node: _node, ...props }) => (
    <sup
      className={cn("text-sm", className)}
      data-nakafa="superscript"
      {...props}
    >
      {children}
    </sup>
  ),
  ul: ({ node: _node, ...props }) => (
    <ul
      className="my-4 list-disc space-y-4 last:mb-0"
      data-nakafa="unordered-list"
      {...props}
    />
  ),
};
