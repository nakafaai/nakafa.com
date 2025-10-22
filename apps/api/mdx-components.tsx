import { components } from "@repo/design-system/components/markdown/mdx";
import type { MDXComponents } from "@repo/design-system/types/markdown";

export function useMDXComponents(inherited: MDXComponents): MDXComponents {
  return {
    ...inherited,
    ...components,
  };
}
