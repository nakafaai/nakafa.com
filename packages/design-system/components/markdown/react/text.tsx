import { Anchor } from "@repo/design-system/components/markdown/anchor";
import { Heading } from "@repo/design-system/components/markdown/heading";
import { MarkdownImage } from "@repo/design-system/components/markdown/image";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import type { ReactMarkdownComponents } from "@repo/design-system/components/markdown/react/node";
import { cn } from "@repo/design-system/lib/utils";

export const reactTextComponents: ReactMarkdownComponents = {
  a: ({ ...props }) => <Anchor data-nakafa="anchor" {...props} />,
  blockquote: ({ ...props }) => (
    <blockquote
      className="my-4 rounded-r-xl border-foreground border-l-2 bg-muted p-4 italic"
      data-nakafa="quote"
      {...props}
    />
  ),
  em: ({ ...props }) => (
    <em className="font-medium" data-nakafa="italic" {...props} />
  ),
  h1: ({ ...props }) => (
    <Heading
      className="mt-6 mb-4 text-2xl"
      data-nakafa="heading-1"
      Tag="h1"
      {...props}
      enableLink={false}
    />
  ),
  h2: ({ ...props }) => (
    <Heading
      className="mt-6 mb-4 text-xl"
      data-nakafa="heading-2"
      Tag="h2"
      {...props}
      enableLink={false}
    />
  ),
  h3: ({ ...props }) => (
    <Heading
      className="mt-6 mb-4 text-lg"
      data-nakafa="heading-3"
      Tag="h3"
      {...props}
      enableLink={false}
    />
  ),
  h4: ({ ...props }) => (
    <Heading
      className="mt-6 mb-4 text-base"
      data-nakafa="heading-4"
      Tag="h4"
      {...props}
      enableLink={false}
    />
  ),
  h5: ({ ...props }) => (
    <Heading
      className="mt-6 mb-4 text-base"
      data-nakafa="heading-5"
      Tag="h5"
      {...props}
      enableLink={false}
    />
  ),
  h6: ({ ...props }) => (
    <Heading
      className="mt-6 mb-4 text-base"
      data-nakafa="heading-6"
      Tag="h6"
      {...props}
      enableLink={false}
    />
  ),
  hr: ({ ...props }) => (
    <hr className="my-4 border-border" data-nakafa="hr" {...props} />
  ),
  img: ({ ...props }) => <MarkdownImage data-nakafa="image" {...props} />,
  li: ({ ...props }) => (
    <li
      className="text-pretty pl-1 leading-relaxed [&>*+*]:mt-4 [&>p:first-child]:inline"
      data-nakafa="list-item"
      {...props}
    />
  ),
  ol: ({ ...props }) => (
    <ol
      className="my-4 list-decimal space-y-4 pl-4.5 last:mb-0"
      data-nakafa="ordered-list"
      {...props}
    />
  ),
  p: ({ ...props }) => <Paragraph data-nakafa="paragraph" {...props} />,
  strong: ({ ...props }) => (
    <strong className="font-medium" data-nakafa="bold" {...props} />
  ),
  sub: ({ children, className, ...props }) => (
    <sub
      className={cn("text-sm", className)}
      data-nakafa="subscript"
      {...props}
    >
      {children}
    </sub>
  ),
  sup: ({ children, className, ...props }) => (
    <sup
      className={cn("text-sm", className)}
      data-nakafa="superscript"
      {...props}
    >
      {children}
    </sup>
  ),
  ul: ({ ...props }) => (
    <ul
      className="my-4 list-disc space-y-4 pl-4.5 last:mb-0"
      data-nakafa="unordered-list"
      {...props}
    />
  ),
};
