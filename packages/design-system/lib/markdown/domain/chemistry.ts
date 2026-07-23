import { AtomShellLab } from "@repo/design-system/components/contents/chemistry/atom-shell/lab";
import { chemistryComponentNames } from "@repo/design-system/lib/markdown/names";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Rich component implementations owned by chemistry routes. */
export const chemistryRegistry = {
  [chemistryComponentNames.atomShellLab]: AtomShellLab,
} satisfies MDXComponents;

/** Complete renderer used only by chemistry routes. */
export const chemistryComponents: MDXComponents = {
  ...mdxComponents,
  ...chemistryRegistry,
};
