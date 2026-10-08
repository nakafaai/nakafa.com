"use client";

import { useControllableState } from "@repo/design-system/hooks/use-controllable-state";
import {
  CodeBlockContext,
  type CodeBlockData,
  useCodeBlockContextValue,
} from "@repo/design-system/lib/code-block/context";
import { cn } from "cn";
import type { HTMLAttributes } from "react";

/** Controlled or uncontrolled source selection for a composed code block. */
type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  data: CodeBlockData[];
};

/** Provides code-block tab state and source data to child controls. */
export function CodeBlock({
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  defaultValue,
  className,
  data,
  ...props
}: CodeBlockProps) {
  const [value, onValueChange] = useControllableState({
    defaultProp: defaultValue ?? "",
    prop: controlledValue,
    ...(controlledOnValueChange === undefined
      ? {}
      : { onChange: controlledOnValueChange }),
  });
  const contextValue = useCodeBlockContextValue(data, value, onValueChange);

  return (
    <CodeBlockContext value={contextValue}>
      <div
        className={cn(
          "grid size-full grid-cols-1 overflow-hidden rounded-xl border shadow-sm",
          className
        )}
        {...props}
      />
    </CodeBlockContext>
  );
}
