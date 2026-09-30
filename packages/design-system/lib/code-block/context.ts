"use client";

import { createContext, useContextSelector } from "use-context-selector";

/** One named language source rendered by a tabbed code block. */
export interface CodeBlockData {
  code: string;
  filename: string;
  language: string;
}

/** State shared by the composed code-block controls. */
export interface CodeBlockContextValue {
  data: CodeBlockData[];
  onValueChange: ((value: string) => void) | undefined;
  value: string | undefined;
}

const missingCodeBlock = Symbol("missing-code-block");

/** @internal Context consumed by CodeBlock and its composed controls. */
export const CodeBlockContext = createContext<
  CodeBlockContextValue | typeof missingCodeBlock
>(missingCodeBlock);

/** Reads one selected value from the nearest code-block state provider. */
export function useCodeBlock<T>(
  selector: (state: CodeBlockContextValue) => T
): T {
  const selected = useContextSelector(CodeBlockContext, (value) =>
    value === missingCodeBlock ? missingCodeBlock : selector(value)
  );
  if (selected === missingCodeBlock) {
    throw new Error("CodeBlock components must be used within CodeBlock.");
  }

  return selected;
}
