import { Anchor } from "@repo/design-system/components/markdown/anchor";
import { Heading } from "@repo/design-system/components/markdown/heading";
import { MarkdownImage } from "@repo/design-system/components/markdown/image";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import {
  type ReactMarkdownComponents,
  sameClassAndNode,
} from "@repo/design-system/components/markdown/react-node";
import { cn } from "@repo/design-system/lib/utils";
import { memo } from "react";

export const reactTextComponents: ReactMarkdownComponents = {
  a: memo(
    ({ ...props }) => <Anchor data-nakafa="anchor" {...props} />,
    (previous, next) => sameClassAndNode(previous, next)
  ),
  blockquote: memo(
    ({ ...props }) => (
      <blockquote
        className="my-4 rounded-r-xl border-foreground border-l-2 bg-muted p-4 italic"
        data-nakafa="quote"
        {...props}
      />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  em: memo(
    ({ ...props }) => (
      <em className="font-medium" data-nakafa="italic" {...props} />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  h1: memo(
    ({ ...props }) => (
      <Heading
        className="mt-6 mb-4 text-2xl"
        data-nakafa="heading-1"
        Tag="h1"
        {...props}
        enableLink={false}
      />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  h2: memo(
    ({ ...props }) => (
      <Heading
        className="mt-6 mb-4 text-xl"
        data-nakafa="heading-2"
        Tag="h2"
        {...props}
        enableLink={false}
      />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  h3: memo(
    ({ ...props }) => (
      <Heading
        className="mt-6 mb-4 text-lg"
        data-nakafa="heading-3"
        Tag="h3"
        {...props}
        enableLink={false}
      />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  h4: memo(
    ({ ...props }) => (
      <Heading
        className="mt-6 mb-4 text-base"
        data-nakafa="heading-4"
        Tag="h4"
        {...props}
        enableLink={false}
      />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  h5: memo(
    ({ ...props }) => (
      <Heading
        className="mt-6 mb-4 text-base"
        data-nakafa="heading-5"
        Tag="h5"
        {...props}
        enableLink={false}
      />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  h6: memo(
    ({ ...props }) => (
      <Heading
        className="mt-6 mb-4 text-base"
        data-nakafa="heading-6"
        Tag="h6"
        {...props}
        enableLink={false}
      />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  hr: memo(
    ({ ...props }) => (
      <hr className="my-4 border-border" data-nakafa="hr" {...props} />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  img: memo(
    ({ ...props }) => <MarkdownImage data-nakafa="image" {...props} />,
    (previous, next) => sameClassAndNode(previous, next)
  ),
  li: memo(
    ({ ...props }) => (
      <li
        className="space-y-4 text-pretty pl-1 leading-relaxed"
        data-nakafa="list-item"
        {...props}
      />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  ol: memo(
    ({ ...props }) => (
      <ol
        className="my-4 list-decimal space-y-4 pl-4.5 last:mb-0"
        data-nakafa="ordered-list"
        {...props}
      />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  p: memo(
    ({ ...props }) => <Paragraph data-nakafa="paragraph" {...props} />,
    (previous, next) => sameClassAndNode(previous, next)
  ),
  strong: memo(
    ({ ...props }) => (
      <strong className="font-medium" data-nakafa="bold" {...props} />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  sub: memo(
    ({ children, className, ...props }) => (
      <sub
        className={cn("text-sm", className)}
        data-nakafa="subscript"
        {...props}
      >
        {children}
      </sub>
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  sup: memo(
    ({ children, className, ...props }) => (
      <sup
        className={cn("text-sm", className)}
        data-nakafa="superscript"
        {...props}
      >
        {children}
      </sup>
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  ul: memo(
    ({ ...props }) => (
      <ul
        className="my-4 list-disc space-y-4 pl-4.5 last:mb-0"
        data-nakafa="unordered-list"
        {...props}
      />
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
};
