"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";

/** Defers the interactive highlighter until an authored code block renders. */
export const CodeBlockMdx = lazyComponent(() =>
  import("@repo/design-system/components/markdown/code/block").then(
    ({ CodeBlockMdx }) => CodeBlockMdx
  )
);
