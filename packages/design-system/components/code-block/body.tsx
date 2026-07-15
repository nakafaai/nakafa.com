"use client";

import { codeBlockDarkModeVariants } from "@repo/design-system/components/code-block/variants";
import {
  type CodeBlockData,
  useCodeBlock,
} from "@repo/design-system/lib/code-block/context";
import { cn } from "@repo/design-system/lib/utils";
import { cva } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";

const codeBlockLineNumberVariants = cva(
  "[&_.line]:before:mr-4 [&_.line]:before:inline-block [&_.line]:before:w-4 [&_.line]:before:select-none [&_.line]:before:text-right [&_.line]:before:font-mono [&_.line]:before:text-muted-foreground [&_.line]:before:text-xs [&_.line]:before:content-[counter(line)] [&_.line]:before:[counter-increment:line] [&_code]:[counter-increment:line_0] [&_code]:[counter-reset:line]"
);

const codeBlockLineHighlightVariants = cva(
  "[&_.line.highlighted]:after:absolute [&_.line.highlighted]:after:top-0 [&_.line.highlighted]:after:bottom-0 [&_.line.highlighted]:after:left-0 [&_.line.highlighted]:after:w-0.5 [&_.line.highlighted]:after:bg-primary"
);

const codeBlockLineDiffVariants = cva(
  "[&_.line.diff.add]:after:bg-primary [&_.line.diff.remove]:after:bg-destructive [&_.line.diff]:after:absolute [&_.line.diff]:after:top-0 [&_.line.diff]:after:bottom-0 [&_.line.diff]:after:left-0 [&_.line.diff]:after:w-0.5"
);

const codeBlockLineFocusedVariants = cva(
  "[&_code:has(.focused)_.line.focused]:blur-none [&_code:has(.focused)_.line]:blur-[2px]"
);

const codeBlockWordHighlightVariants = cva(
  "[&_.highlighted-word]:underline [&_.highlighted-word]:decoration-current [&_.highlighted-word]:underline-offset-2"
);

const codeBlockVariants = cva(
  "mt-0 bg-muted/40 text-sm [&_.line]:relative [&_.line]:w-full [&_.line]:px-4 [&_.shiki]:bg-(--shiki-bg)! [&_code]:grid [&_code]:w-full [&_code]:bg-transparent [&_pre]:overflow-x-auto [&_pre]:py-4"
);

/** Render-prop contract for projecting every code source into the body. */
export type CodeBlockBodyProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  children: (item: CodeBlockData) => ReactNode;
};

/** Maps every source into the code block's content region. */
export const CodeBlockBody = ({ children, ...props }: CodeBlockBodyProps) => {
  const data = useCodeBlock((state) => state.data);

  return <div {...props}>{data.map(children)}</div>;
};

/** Active-source identity and optional line-number presentation. */
export type CodeBlockItemProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
  lineNumbers?: boolean;
};

/** Renders one source only while its value is active. */
export const CodeBlockItem = ({
  children,
  lineNumbers = true,
  className,
  value,
  ...props
}: CodeBlockItemProps) => {
  const activeValue = useCodeBlock((state) => state.value);

  if (value !== activeValue) {
    return null;
  }

  return (
    <div
      className={cn(
        codeBlockVariants(),
        codeBlockLineHighlightVariants(),
        codeBlockLineDiffVariants(),
        codeBlockLineFocusedVariants(),
        codeBlockWordHighlightVariants(),
        codeBlockDarkModeVariants(),
        !!lineNumbers && codeBlockLineNumberVariants(),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
