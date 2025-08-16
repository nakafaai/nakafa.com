"use client";

import {
  cleanMarkdown,
  parseIncompleteMarkdown,
  parseMarkdownIntoBlocks,
} from "@repo/design-system/lib/markdown";
import { cn } from "@repo/design-system/lib/utils";
import { reactMdxComponents } from "@repo/design-system/markdown/react-mdx";
import hardenReactMarkdown from "harden-react-markdown";
import type { ComponentProps } from "react";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";

export type HardenedMarkdownProps = {
  allowedImagePrefixes?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >["allowedImagePrefixes"];
  allowedLinkPrefixes?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >["allowedLinkPrefixes"];
  defaultOrigin?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >["defaultOrigin"];
};

export type ResponseProps = {
  id: string;
  children: string;
  className?: string;
  parseIncompleteMarkdown?: boolean;
} & HardenedMarkdownProps;

// Create a hardened version of ReactMarkdown
const HardenedMarkdown = memo(
  hardenReactMarkdown(ReactMarkdown),
  (prevProps, nextProps) => {
    return prevProps.children === nextProps.children;
  }
);
HardenedMarkdown.displayName = "HardenedMarkdown";

const HardenedMarkdownBlocks = memo(
  ({
    id,
    children,
    ...props
  }: HardenedMarkdownProps & Pick<ResponseProps, "children" | "id">) => {
    const blocks = useMemo(() => {
      return parseMarkdownIntoBlocks(cleanMarkdown(children)).filter(
        (block) => cleanMarkdown(block).length > 0
      );
    }, [children]);

    return blocks.map((block, index) => (
      <HardenedMarkdown
        components={reactMdxComponents}
        // biome-ignore lint/suspicious/noArrayIndexKey: We need to use the index as key to prevent the component from re-rendering
        key={`${id}-block_${index}`}
        remarkPlugins={[remarkGfm, remarkMath, remarkRehype]}
        {...props}
      >
        {block}
      </HardenedMarkdown>
    ));
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
HardenedMarkdownBlocks.displayName = "HardenedMarkdownBlocks";

export const Response = memo(
  ({
    id,
    className,
    children,
    allowedImagePrefixes,
    allowedLinkPrefixes,
    defaultOrigin = "https://nakafa.com",
    parseIncompleteMarkdown: shouldParseIncompleteMarkdown = true,
  }: ResponseProps) => {
    // Parse the children to remove incomplete markdown tokens if enabled
    const parsedChildren = useMemo(
      () =>
        shouldParseIncompleteMarkdown
          ? parseIncompleteMarkdown(children)
          : children,
      [children, shouldParseIncompleteMarkdown]
    );

    return (
      <div
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
      >
        <HardenedMarkdownBlocks
          allowedImagePrefixes={allowedImagePrefixes ?? ["*"]}
          allowedLinkPrefixes={allowedLinkPrefixes ?? ["*"]}
          defaultOrigin={defaultOrigin}
          id={id}
        >
          {parsedChildren}
        </HardenedMarkdownBlocks>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
Response.displayName = "Response";
