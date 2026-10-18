import {
  type MarkdownFrameVariant,
  markdownFrameVariants,
} from "@repo/design-system/components/markdown/frame";
import { reactMdxComponents } from "@repo/design-system/components/markdown/react/mdx";
import { readMarkdownBlocks } from "@repo/design-system/lib/markdown/blocks";
import { rehypeDirection } from "@repo/design-system/lib/markdown/direction";
import { normalizeText } from "@repo/design-system/lib/markdown/normalize";
import { preprocessLaTeX } from "@repo/math/latex";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { cn } from "cn";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import { harden } from "rehype-harden";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const DEFAULT_ALLOWED_PREFIXES = ["*"];
const REMARK_PLUGINS = [
  remarkGfm,
  [remarkMath, { singleDollarTextMath: false }],
] satisfies ComponentProps<typeof ReactMarkdown>["remarkPlugins"];

type HardenOptions = Parameters<typeof harden>[0];

/** The link and image policy that a markdown block renders under. */
interface MarkdownSecurityProps {
  allowedImagePrefixes?: HardenOptions["allowedImagePrefixes"];
  allowedLinkPrefixes?: HardenOptions["allowedLinkPrefixes"];
  defaultOrigin?: HardenOptions["defaultOrigin"];
}

export type MarkdownContentProps = {
  readonly children: string;
  readonly className?: string;
  readonly id: string;
} & MarkdownSecurityProps &
  MarkdownFrameVariant;

/**
 * Renders one normalized, hardened markdown block. A surface that draws other
 * text than Nina's answers adds its own rehype plugins after the hardening, and
 * may show raw HTML as the text it was written as instead of dropping it.
 */
export function MarkdownBlock({
  children,
  components = reactMdxComponents,
  rehypePlugins = [],
  security = {},
  skipHtml = true,
}: {
  readonly children: string;
  readonly components?: ComponentProps<typeof ReactMarkdown>["components"];
  readonly rehypePlugins?: ComponentProps<
    typeof ReactMarkdown
  >["rehypePlugins"];
  readonly security?: MarkdownSecurityProps;
  readonly skipHtml?: boolean;
}) {
  const {
    allowedImagePrefixes = DEFAULT_ALLOWED_PREFIXES,
    allowedLinkPrefixes = DEFAULT_ALLOWED_PREFIXES,
    defaultOrigin = SITE_ORIGIN,
  } = security;
  const parsedContent = preprocessLaTeX(children.trim());

  if (!parsedContent.trim()) {
    return null;
  }

  return (
    <ReactMarkdown
      components={components}
      rehypePlugins={[
        [harden, { allowedImagePrefixes, allowedLinkPrefixes, defaultOrigin }],
        rehypeDirection,
        ...(rehypePlugins ?? []),
      ]}
      remarkPlugins={REMARK_PLUGINS}
      skipHtml={skipHtml}
    >
      {parsedContent}
    </ReactMarkdown>
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
  variant,
}: MarkdownContentProps) {
  const blocks = readMarkdownBlocks(id, normalizeText(children));
  // Server components cannot read React context, so the document passes its
  // link and image policy to each block as one value.
  const security = { allowedImagePrefixes, allowedLinkPrefixes, defaultOrigin };

  return (
    <div className={cn(markdownFrameVariants({ variant }), className)}>
      {Arr.map(blocks, (block) => (
        <MarkdownBlock key={block.key} security={security}>
          {block.content}
        </MarkdownBlock>
      ))}
    </div>
  );
}
