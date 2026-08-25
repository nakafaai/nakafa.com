"use client";

import dynamic from "next/dynamic";

/** Defers the interactive highlighter until an authored code block renders. */
export const CodeBlockMdx = dynamic(() =>
  import("@repo/design-system/components/markdown/code/block").then(
    ({ CodeBlockMdx }) => CodeBlockMdx
  )
);
