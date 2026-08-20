import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Public site pages intentionally own no rich MDX implementations. */
export const siteRegistry = {} satisfies MDXComponents;

/** Complete renderer used only by public site pages. */
export const siteComponents: MDXComponents = {
  ...mdxComponents,
  ...siteRegistry,
};
