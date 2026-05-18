"use client";

import { InlineMath } from "@repo/design-system/components/markdown/math";

interface ExpressionProps {
  value: string;
}

/** Keeps rendered math in the same muted tone as the surrounding evidence. */
export function Expression({ value }: ExpressionProps) {
  return (
    <span className="inline-flex max-w-full shrink-0 items-center text-muted-foreground [&_.katex]:text-muted-foreground">
      <InlineMath>{value}</InlineMath>
    </span>
  );
}
