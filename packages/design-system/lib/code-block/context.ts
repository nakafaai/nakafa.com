"use client";

import { Schema } from "effect";
import { createContext, use, useMemo } from "react";

const CodeBlockDataSchema = Schema.Struct({
  code: Schema.String,
  filename: Schema.String,
  language: Schema.String,
});

/** One named language source rendered by a tabbed code block. */
export type CodeBlockData = typeof CodeBlockDataSchema.Type;

/** Receives the newly selected value when the code block changes its source. */
type CodeBlockValueChange = (value: string) => void;

/** Builds the state that every composed code-block control reads from its provider. */
export function useCodeBlockContextValue(
  data: CodeBlockData[],
  value: string | undefined,
  onValueChange: CodeBlockValueChange | undefined
) {
  return useMemo(
    () => ({ data, onValueChange, value }),
    [data, onValueChange, value]
  );
}

/** State shared by the composed code-block controls. */
export type CodeBlockContextValue = ReturnType<typeof useCodeBlockContextValue>;

/** @internal Context consumed by CodeBlock and its composed controls. */
export const CodeBlockContext = createContext<CodeBlockContextValue | null>(
  null
);

/** Reads one selected value from the nearest code-block state provider. */
export function useCodeBlock<T>(
  selector: (state: CodeBlockContextValue) => T
): T {
  const value = use(CodeBlockContext);
  if (!value) {
    throw new Error("CodeBlock components must be used within CodeBlock.");
  }

  return selector(value);
}
