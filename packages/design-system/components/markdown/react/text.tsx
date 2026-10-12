import { Anchor } from "@repo/design-system/components/markdown/anchor";
import { Heading } from "@repo/design-system/components/markdown/heading";
import { MarkdownImage } from "@repo/design-system/components/markdown/image";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import type { ReactMarkdownComponents } from "@repo/design-system/components/markdown/react/node";
import { emphasisVariants } from "@repo/design-system/lib/markdown/emphasis";
import { cn } from "cn";

/**
 * The block elements of a Markdown response take the direction of their own
 * content (`dir="auto"`), so an Arabic paragraph, list, heading or cell starts
 * at its own side and its markers and punctuation follow, in an answer that
 * mixes scripts as much as in one that is wholly Arabic. The lesson renderer
 * does not map these elements here, so its text is unchanged.
 *
 * A list sets its direction and its items inherit it. An element reads its
 * direction from its text and passes over any child that has a `dir` of its
 * own, so a list whose items had one would find no text and stay as the page
 * is, and its marker room would stay on the wrong side.
 */
export const reactTextComponents: ReactMarkdownComponents = {
  a: ({ node: _node, ...props }) => <Anchor data-nakafa="anchor" {...props} />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="my-4 rounded-r-xl border-foreground border-l-2 bg-muted p-4 italic"
      data-nakafa="quote"
      {...props}
    />
  ),
  em: ({ node: _node, ...props }) => <em data-nakafa="italic" {...props} />,
  h1: ({ node: _node, ...props }) => (
    <Heading
      className="mt-6 mb-4 text-2xl"
      data-nakafa="heading-1"
      dir="auto"
      Tag="h1"
      {...props}
      enableLink={false}
    />
  ),
  h2: ({ node: _node, ...props }) => (
    <Heading
      className="mt-6 mb-4 text-xl"
      data-nakafa="heading-2"
      dir="auto"
      Tag="h2"
      {...props}
      enableLink={false}
    />
  ),
  h3: ({ node: _node, ...props }) => (
    <Heading
      className="mt-6 mb-4 text-lg"
      data-nakafa="heading-3"
      dir="auto"
      Tag="h3"
      {...props}
      enableLink={false}
    />
  ),
  h4: ({ node: _node, ...props }) => (
    <Heading
      className="mt-6 mb-4 text-base"
      data-nakafa="heading-4"
      dir="auto"
      Tag="h4"
      {...props}
      enableLink={false}
    />
  ),
  h5: ({ node: _node, ...props }) => (
    <Heading
      className="mt-6 mb-4 text-base"
      data-nakafa="heading-5"
      dir="auto"
      Tag="h5"
      {...props}
      enableLink={false}
    />
  ),
  h6: ({ node: _node, ...props }) => (
    <Heading
      className="mt-6 mb-4 text-base"
      data-nakafa="heading-6"
      dir="auto"
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
      className="text-pretty ps-1 leading-relaxed [&>*+*]:mt-4 [&>p:first-child]:inline"
      data-nakafa="list-item"
      {...props}
    />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol
      className="my-4 list-decimal space-y-4 ps-8 last:mb-0"
      data-nakafa="ordered-list"
      dir="auto"
      {...props}
    />
  ),
  p: ({ node: _node, ...props }) => (
    <Paragraph data-nakafa="paragraph" dir="auto" {...props} />
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
      className="my-4 list-disc space-y-4 ps-8 last:mb-0"
      data-nakafa="unordered-list"
      dir="auto"
      {...props}
    />
  ),
};
