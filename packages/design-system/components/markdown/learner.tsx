import { MarkdownBlock } from "@repo/design-system/components/markdown/content";
import { reactMdxComponents } from "@repo/design-system/components/markdown/react/mdx";
import type { ReactMarkdownComponents } from "@repo/design-system/components/markdown/react/node";
import { rehypeLearnerText } from "@repo/design-system/lib/markdown/learner";
import type { AnchorProps } from "@repo/design-system/types/markdown";
import { cn } from "cn";
import type { ComponentProps } from "react";

/**
 * A link a learner wrote opens in a new tab and passes on no trust to the page
 * it leads to. Without an address the link keeps its words and draws no link.
 */
function LearnerLink({ children, href, title, ...props }: AnchorProps) {
  if (!href) {
    return <>{children}</>;
  }

  return (
    <a
      className="text-primary underline underline-offset-4"
      data-nakafa="anchor"
      href={href}
      title={title ?? href}
      {...props}
      rel="noopener noreferrer nofollow ugc"
      target="_blank"
    >
      {children}
    </a>
  );
}

/**
 * An image a learner wrote is never loaded. Its address is drawn as a link,
 * named by the alt text, or by the address when there is no alt text.
 */
function LearnerImage({ alt, src }: ComponentProps<"img">) {
  const address = typeof src === "string" ? src : "";
  const label = alt?.trim() ? alt : address;

  if (!address) {
    return label || null;
  }

  return <LearnerLink href={address}>{label}</LearnerLink>;
}

/**
 * The components of learner text. They are the parts of Nina's answers, with
 * the headings, the bold and the links that learner text needs: every heading
 * at the body size, and bold as plain semibold, so a post never shouts.
 */
const learnerComponents: ReactMarkdownComponents = {
  ...reactMdxComponents,
  a: ({ node: _node, ...props }) => <LearnerLink {...props} />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="rounded-r-xl border-foreground border-l-2 bg-muted p-4 italic *:mt-3 *:first:mt-0"
      data-nakafa="quote"
      {...props}
    />
  ),
  h1: ({ node: _node, ...props }) => (
    <h1 className="font-semibold" data-nakafa="heading-1" {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 className="font-semibold" data-nakafa="heading-2" {...props} />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="font-semibold" data-nakafa="heading-3" {...props} />
  ),
  h4: ({ node: _node, ...props }) => (
    <h4 className="font-semibold" data-nakafa="heading-4" {...props} />
  ),
  h5: ({ node: _node, ...props }) => (
    <h5 className="font-semibold" data-nakafa="heading-5" {...props} />
  ),
  h6: ({ node: _node, ...props }) => (
    <h6 className="font-semibold" data-nakafa="heading-6" {...props} />
  ),
  hr: ({ node: _node, ...props }) => (
    <hr className="border-border" data-nakafa="hr" {...props} />
  ),
  img: ({ node: _node, ...props }) => <LearnerImage {...props} />,
  li: ({ node: _node, ...props }) => (
    <li
      className="ms-8 mt-1 text-pretty ps-1 text-start leading-relaxed first:mt-0 [&>p:first-child]:inline"
      data-nakafa="list-item"
      {...props}
    />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="list-decimal" data-nakafa="ordered-list" {...props} />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold" data-nakafa="strong" {...props} />
  ),
  p: ({ node: _node, ...props }) => (
    <p
      className="text-pretty leading-relaxed"
      data-nakafa="paragraph"
      {...props}
    />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="list-disc" data-nakafa="unordered-list" {...props} />
  ),
};

/** The rehype plugins of learner text, after the hardening of Nina's answers. */
const LEARNER_PLUGINS = [rehypeLearnerText];

/**
 * Draws text a learner wrote as Markdown, through the pipeline of Nina's
 * answers, so a formula reads the same in both. Every block, a code block, a
 * formula and a table included, sits one gap of `mt-3` below the one before
 * it, with none above the first or below the last. Each line break the learner
 * wrote stays, asterisks inside words stay, and text that reads as HTML shows
 * as written. Each block reads in the direction of its own text (the pipeline's
 * `rehypeDirection`), so the wrapper names none: a wrapper with `dir="auto"`
 * would skip those blocks and read as left to right. The text takes the size
 * and the color of the place it is in.
 */
export function LearnerText({
  children,
  className,
}: {
  readonly children: string;
  readonly className?: string | undefined;
}) {
  return (
    <div className={cn("wrap-anywhere *:mt-3 *:mb-0 *:first:mt-0", className)}>
      <MarkdownBlock
        components={learnerComponents}
        rehypePlugins={LEARNER_PLUGINS}
        skipHtml={false}
      >
        {children}
      </MarkdownBlock>
    </div>
  );
}
