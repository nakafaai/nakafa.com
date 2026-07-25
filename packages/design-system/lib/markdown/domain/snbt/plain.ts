import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** SNBT plain-text routes intentionally own no rich MDX implementations. */
export const snbtPlainRegistry = {} satisfies MDXComponents;

/** Complete renderer used only by SNBT plain-text routes. */
export const snbtPlainComponents: MDXComponents = {
  ...mdxComponents,
  ...snbtPlainRegistry,
};
