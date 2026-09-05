import { AgentContext } from "@repo/design-system/components/markdown/agent-context";
import { CodeBlockMdx } from "@repo/design-system/components/markdown/code/client";
import {
  BlockMath,
  InlineMath,
  MathContainer,
} from "@repo/design-system/components/markdown/math";
import {
  ContentBlock,
  ContentGrid,
  ContentStack,
} from "@repo/design-system/components/markdown/mdx";
import { baseComponentNames } from "@repo/design-system/lib/markdown/names";
import { MermaidMdx, Youtube } from "@/lib/content/renderer/client/base/media";
import { MathVisual } from "@/lib/content/renderer/client/base/visual/math";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Statically registered implementations for signed base custom components. */
export const baseRenderers = [
  {
    name: baseComponentNames.agentContext,
    component: AgentContext,
  },
  {
    name: baseComponentNames.blockMath,
    component: BlockMath,
  },
  {
    name: baseComponentNames.codeBlock,
    component: CodeBlockMdx,
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
    name: baseComponentNames.inlineMath,
    component: InlineMath,
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
