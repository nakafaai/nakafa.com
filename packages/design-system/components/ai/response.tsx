"use client";

import { reactMdxComponents } from "@repo/design-system/components/markdown/react-mdx";
import { normalizeText } from "@repo/design-system/lib/normalize";
import { parseMarkdownIntoBlocks } from "@repo/design-system/lib/parse-blocks";
import { preprocessLaTeX } from "@repo/design-system/lib/parse-math";
import { cn } from "@repo/design-system/lib/utils";
import hardenReactMarkdown from "harden-react-markdown";
import type { ComponentProps } from "react";
import { memo, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
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
} & HardenedMarkdownProps;

const MemoizedHardenedMarkdown = memo(
  hardenReactMarkdown(ReactMarkdown),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
MemoizedHardenedMarkdown.displayName = "MemoizedHardenedMarkdown";

const Block = memo(
  ({
    children,
    ...props
  }: HardenedMarkdownProps & Pick<ResponseProps, "children">) => {
    const parsedContent = useMemo(
      () => preprocessLaTeX(children.trim()),
      [children],
    );

    // Return null if content is empty after trimming whitespace
    if (!parsedContent.trim()) {
      return null;
    }

    return (
      <MemoizedHardenedMarkdown
        components={reactMdxComponents}
        rehypePlugins={[rehypeRaw]}
        remarkPlugins={[
          remarkGfm,
          [remarkMath, { singleDollarTextMath: false }],
          remarkRehype,
        ]}
        {...props}
      >
        {parsedContent}
      </MemoizedHardenedMarkdown>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
Block.displayName = "Block";

const Blocks = memo(
  ({
    id,
    children,
    ...props
  }: HardenedMarkdownProps & Pick<ResponseProps, "children" | "id">) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children]);

    return blocks.map((block, index) => (
      <Block
        // biome-ignore lint/suspicious/noArrayIndexKey: We need to use the index as key to prevent the component from re-rendering
        key={`${id}-block_${index}`}
        {...props}
      >
        {block}
      </Block>
    ));
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
Blocks.displayName = "Blocks";

const ResponseContent = memo(
  ({
    className,
    children,
    allowedImagePrefixes = ["*"],
    allowedLinkPrefixes = ["*"],
    defaultOrigin = "https://nakafa.com",
    ...props
  }: ResponseProps) => (
    <div
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <Blocks
        allowedImagePrefixes={allowedImagePrefixes}
        allowedLinkPrefixes={allowedLinkPrefixes}
        defaultOrigin={defaultOrigin}
        {...props}
      >
        {children}
      </Blocks>
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
ResponseContent.displayName = "ResponseContent";

export const Response = memo(
  ({
    id,
    children,
    className,
    allowedImagePrefixes,
    allowedLinkPrefixes,
    defaultOrigin,
  }: ResponseProps) => {
    const wrap = useCallback(
      (v: string) => {
        const normalizedChildren = normalizeText(v);
        return (
          <ResponseContent
            allowedImagePrefixes={allowedImagePrefixes}
            allowedLinkPrefixes={allowedLinkPrefixes}
            className={className}
            defaultOrigin={defaultOrigin}
            id={id}
          >
            {normalizedChildren}
          </ResponseContent>
        );
      },
      [id, className, allowedImagePrefixes, allowedLinkPrefixes, defaultOrigin],
    );

    return wrap(children);
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
Response.displayName = "Response";
