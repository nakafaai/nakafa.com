import { components } from "@repo/design-system/components/markdown/mdx";
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(inherited: MDXComponents): MDXComponents {
  return {
    ...inherited,
    ...components,
  };
}
