"use client";

import { useControllableState } from "@repo/design-system/hooks/use-controllable-state";
import { cn } from "@repo/design-system/lib/utils";
import type { HTMLAttributes } from "react";
import { useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";

/** One named language source rendered by a tabbed code block. */
export interface CodeBlockData {
  code: string;
  filename: string;
  language: string;
}

interface CodeBlockContextValue {
  data: CodeBlockData[];
  onValueChange: ((value: string) => void) | undefined;
  value: string | undefined;
}

const CodeBlockContext = createContext<CodeBlockContextValue | null>(null);

/** Reads one selected value from the nearest code-block state provider. */
export function useCodeBlock<T>(
  selector: (state: CodeBlockContextValue) => T
): T {
  const context = useContextSelector(CodeBlockContext, (value) => value);
  if (!context) {
    throw new Error("CodeBlock components must be used within CodeBlock.");
  }

  return selector(context);
}

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
