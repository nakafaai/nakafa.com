"use client";

import { useControllableState } from "@repo/design-system/hooks/use-controllable-state";
import {
  CodeBlockContext,
  type CodeBlockData,
} from "@repo/design-system/lib/code-block/context";
import { cn } from "@repo/design-system/lib/utils";
import type { HTMLAttributes } from "react";
import { useMemo } from "react";

/** Controlled or uncontrolled source selection for a composed code block. */
export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  data: CodeBlockData[];
};

/** Provides code-block tab state and source data to child controls. */
export const CodeBlock = ({
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  defaultValue,
  className,
  data,
  ...props
}: CodeBlockProps) => {
  const [value, onValueChange] = useControllableState({
    defaultProp: defaultValue ?? "",
    prop: controlledValue,
    onChange: controlledOnValueChange,
  });
  const contextValue = useMemo(
    () => ({ value, onValueChange, data }),
    [value, onValueChange, data]
  );

  return (
    <CodeBlockContext.Provider value={contextValue}>
      <div
        className={cn(
          "grid size-full grid-cols-1 overflow-hidden rounded-xl border shadow-sm",
          className
        )}
        {...props}
      />
    </CodeBlockContext.Provider>
  );
};
