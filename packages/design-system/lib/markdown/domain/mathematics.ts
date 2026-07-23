import { FunctionMachine } from "@repo/design-system/components/contents/mathematics/function-machine";
import { mathematicsComponentNames } from "@repo/design-system/lib/markdown/names";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Rich component implementations owned by mathematics routes. */
export const mathematicsRegistry = {
  [mathematicsComponentNames.functionMachine]: FunctionMachine,
} satisfies MDXComponents;

/** Complete renderer used only by mathematics routes. */
export const mathematicsComponents: MDXComponents = {
  ...mdxComponents,
  ...mathematicsRegistry,
};
