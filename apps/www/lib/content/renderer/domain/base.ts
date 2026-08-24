import { baseComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

/** Literal implementation boundaries for signed base custom components. */
export const baseComponentLoaders = [
  {
    name: baseComponentNames.agentContext,
    load: () =>
      import("@repo/design-system/components/markdown/agent-context").then(
        ({ AgentContext }) => AgentContext
      ),
  },
  {
    name: baseComponentNames.blockMath,
    load: () =>
      import("@repo/design-system/components/markdown/math").then(
        ({ BlockMath }) => BlockMath
      ),
  },
  {
    name: baseComponentNames.codeBlock,
    load: () =>
      import("@/lib/content/renderer/client/base").then(
        ({ LazyCodeBlockMdx }) => LazyCodeBlockMdx
      ),
  },
  {
    name: baseComponentNames.contentBlock,
    load: () =>
      import("@repo/design-system/components/markdown/mdx").then(
        ({ ContentBlock }) => ContentBlock
      ),
  },
  {
    name: baseComponentNames.contentGrid,
    load: () =>
      import("@repo/design-system/components/markdown/mdx").then(
        ({ ContentGrid }) => ContentGrid
      ),
  },
  {
    name: baseComponentNames.contentStack,
    load: () =>
      import("@repo/design-system/components/markdown/mdx").then(
        ({ ContentStack }) => ContentStack
      ),
  },
  {
    name: baseComponentNames.inlineMath,
    load: () =>
      import("@repo/design-system/components/markdown/math").then(
        ({ InlineMath }) => InlineMath
      ),
  },
  {
    name: baseComponentNames.mathContainer,
    load: () =>
      import("@repo/design-system/components/markdown/math").then(
        ({ MathContainer }) => MathContainer
      ),
  },
  {
    name: baseComponentNames.mermaid,
    load: () =>
      import("@/lib/content/renderer/client/base").then(
        ({ LazyMermaidMdx }) => LazyMermaidMdx
      ),
  },
  {
    name: baseComponentNames.youtube,
    load: () =>
      import("@repo/design-system/components/markdown/youtube").then(
        ({ Youtube }) => Youtube
      ),
  },
] satisfies readonly RendererComponentLoader[];
