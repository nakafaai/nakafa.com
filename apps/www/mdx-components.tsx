import { components } from "@repo/design-system/components/markdown/mdx";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Returns the shared MDX component map for App Router MDX rendering. */
export function useMDXComponents(): MDXComponents {
  return components;
}
