"use client";

import { useStream } from "@repo/design-system/hooks/use-stream";
import {
  cleanMarkdown,
  parseMarkdown,
  parseMarkdownIntoBlocks,
} from "@repo/design-system/lib/markdown";
import { cn } from "@repo/design-system/lib/utils";
import { reactMdxComponents } from "@repo/design-system/markdown/react-mdx";
import hardenReactMarkdown from "harden-react-markdown";
import type { ComponentProps } from "react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
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
  animate?: boolean;
} & HardenedMarkdownProps;

const MemoizedHardenedMarkdown = memo(
  hardenReactMarkdown(ReactMarkdown),
  (prevProps, nextProps) => {
    return prevProps.children === nextProps.children;
  }
);
MemoizedHardenedMarkdown.displayName = "MemoizedHardenedMarkdown";

const HardenedMarkdownBlock = memo(
  ({
    children,
    ...props
  }: HardenedMarkdownProps & Pick<ResponseProps, "children">) => {
    return (
      <MemoizedHardenedMarkdown
        components={reactMdxComponents}
        rehypePlugins={[rehypeRaw]}
        remarkPlugins={[remarkGfm, remarkMath, remarkRehype]}
        {...props}
      >
        {children}
      </MemoizedHardenedMarkdown>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
HardenedMarkdownBlock.displayName = "HardenedMarkdownBlock";

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
      <HardenedMarkdownBlock
        // biome-ignore lint/suspicious/noArrayIndexKey: We need to use the index as key to prevent the component from re-rendering
        key={`${id}-block_${index}`}
        {...props}
      >
        {block}
      </HardenedMarkdownBlock>
    ));
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
HardenedMarkdownBlocks.displayName = "HardenedMarkdownBlocks";

const ResponseContent = memo(
  ({
    className,
    children,
    allowedImagePrefixes = ["*"],
    allowedLinkPrefixes = ["*"],
    defaultOrigin = "https://nakafa.com",
    ...props
  }: Omit<ResponseProps, "animate">) => {
    const parsedChildren = useMemo(() => parseMarkdown(children), [children]);

    return (
      <div
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
      >
        <HardenedMarkdownBlocks
          allowedImagePrefixes={allowedImagePrefixes}
          allowedLinkPrefixes={allowedLinkPrefixes}
          defaultOrigin={defaultOrigin}
          {...props}
        >
          {parsedChildren}
        </HardenedMarkdownBlocks>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
ResponseContent.displayName = "ResponseContent";

export const Response = memo(
  ({
    id,
    children,
    animate = false,
    className,
    allowedImagePrefixes,
    allowedLinkPrefixes,
    defaultOrigin,
  }: ResponseProps) => {
    const contentRef = useRef("");
    const { stream, addPart } = useStream();

    useEffect(() => {
      if (!(children && animate)) {
        return;
      }

      if (contentRef.current !== children) {
        const delta = children.slice(contentRef.current.length);
        if (delta) {
          addPart(delta);
        }
        contentRef.current = children;
      }
    }, [children, animate, addPart]);

    const wrap = useCallback(
      (v: string) => {
        return (
          <ResponseContent
            allowedImagePrefixes={allowedImagePrefixes}
            allowedLinkPrefixes={allowedLinkPrefixes}
            className={className}
            defaultOrigin={defaultOrigin}
            id={id}
          >
            {v}
          </ResponseContent>
        );
      },
      [id, className, allowedImagePrefixes, allowedLinkPrefixes, defaultOrigin]
    );

    if (!animate) {
      return wrap(children);
    }

    return wrap(stream ?? children ?? "");
  }
);
Response.displayName = "Response";
