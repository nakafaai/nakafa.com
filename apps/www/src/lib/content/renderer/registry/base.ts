import { AgentContext } from "@repo/design-system/components/markdown/agent";
import { MathContainer } from "@repo/design-system/components/markdown/math";
import {
  ContentBlock,
  ContentGrid,
  ContentStack,
  Highlight,
} from "@repo/design-system/components/markdown/mdx";
import { baseComponentNames } from "@repo/design-system/lib/markdown/names";
import { MermaidMdx, Youtube } from "@/lib/content/renderer/client/base/media";
import { MathVisual } from "@/lib/content/renderer/client/base/visual/math";
import { CodeBlockServer } from "@/lib/content/renderer/code.server";
import {
  BlockFormula,
  InlineFormula,
} from "@/lib/content/renderer/formula.server";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Statically registered implementations for signed base custom components. */
export const baseRenderers = [
  {
    name: baseComponentNames.agentContext,
    component: AgentContext,
  },
  {
    name: baseComponentNames.blockMath,
    component: BlockFormula,
  },
  {
    name: baseComponentNames.codeBlock,
    component: CodeBlockServer,
  },
  {
    name: baseComponentNames.contentBlock,
    component: ContentBlock,
  },
  {
    name: baseComponentNames.contentGrid,
    component: ContentGrid,
  },
  {
    name: baseComponentNames.contentStack,
    component: ContentStack,
  },
  {
    name: baseComponentNames.highlight,
    component: Highlight,
  },
  {
    name: baseComponentNames.inlineMath,
    component: InlineFormula,
  },
  {
    name: baseComponentNames.mathContainer,
    component: MathContainer,
  },
  {
    name: baseComponentNames.mathVisual,
    component: MathVisual,
  },
  {
    name: baseComponentNames.mermaid,
    component: MermaidMdx,
  },
  {
    name: baseComponentNames.youtube,
    component: Youtube,
  },
] satisfies readonly RendererImplementation[];
