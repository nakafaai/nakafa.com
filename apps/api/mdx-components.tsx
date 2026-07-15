import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Returns the shared MDX component map for App Router MDX rendering. */
export function useMDXComponents(): MDXComponents {
  return mdxComponents;
}
