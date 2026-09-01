import { reactMdxComponents } from "@repo/design-system/components/markdown/react/mdx";
import { readMarkdownBlocks } from "@repo/design-system/lib/markdown/blocks";
import { preprocessLaTeX } from "@repo/design-system/lib/markdown/math";
import { normalizeText } from "@repo/design-system/lib/markdown/normalize";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { harden } from "rehype-harden";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const DEFAULT_ALLOWED_PREFIXES = ["*"];
const DEFAULT_ORIGIN = "https://nakafa.com";
const REMARK_PLUGINS = [
  remarkGfm,
  [remarkMath, { singleDollarTextMath: false }],
] satisfies ComponentProps<typeof ReactMarkdown>["remarkPlugins"];

type HardenOptions = Parameters<typeof harden>[0];

export interface MarkdownSecurityProps {
  allowedImagePrefixes?: HardenOptions["allowedImagePrefixes"];
  allowedLinkPrefixes?: HardenOptions["allowedLinkPrefixes"];
  defaultOrigin?: HardenOptions["defaultOrigin"];
}

export type MarkdownContentProps = {
  readonly children: string;
  readonly className?: string;
  readonly id: string;
} & MarkdownSecurityProps;

interface MarkdownFrameProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** Renders one normalized, hardened markdown block. */
export function MarkdownBlock({
  allowedImagePrefixes = DEFAULT_ALLOWED_PREFIXES,
  allowedLinkPrefixes = DEFAULT_ALLOWED_PREFIXES,
  children,
  defaultOrigin = DEFAULT_ORIGIN,
}: MarkdownSecurityProps & { readonly children: string }) {
  const parsedContent = preprocessLaTeX(children.trim());

  if (!parsedContent.trim()) {
    return null;
  }

  return (
    <ReactMarkdown
      components={reactMdxComponents}
      rehypePlugins={[
        [harden, { allowedImagePrefixes, allowedLinkPrefixes, defaultOrigin }],
      ]}
      remarkPlugins={REMARK_PLUGINS}
      skipHtml
    >
      {parsedContent}
    </ReactMarkdown>
  );
}

/** Preserves the shared response frame around any rendered block collection. */
export function MarkdownFrame({ children, className }: MarkdownFrameProps) {
  return (
    <div
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Renders one complete non-streaming Markdown document. */
export function MarkdownContent({
  allowedImagePrefixes,
  allowedLinkPrefixes,
  children,
  className,
  defaultOrigin,
  id,
}: MarkdownContentProps) {
  const blocks = readMarkdownBlocks(id, normalizeText(children));

  return (
    <MarkdownFrame className={className}>
      {blocks.map((block) => (
        <MarkdownBlock
          allowedImagePrefixes={allowedImagePrefixes}
          allowedLinkPrefixes={allowedLinkPrefixes}
          defaultOrigin={defaultOrigin}
          key={block.key}
        >
          {block.content}
        </MarkdownBlock>
      ))}
    </MarkdownFrame>
  );
}
