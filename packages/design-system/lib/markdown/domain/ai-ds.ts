import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import { aiDsComponentNames } from "@repo/design-system/lib/markdown/names";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Rich component implementations owned by AI and data-science routes. */
export const aiDsRegistry = {
  [aiDsComponentNames.lineEquation]: LineEquation,
} satisfies MDXComponents;

/** Complete renderer used only by AI and data-science routes. */
export const aiDsComponents: MDXComponents = {
  ...mdxComponents,
  ...aiDsRegistry,
};
