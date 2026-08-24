import { AgentContext } from "@repo/design-system/components/markdown/agent-context";
import { CodeBlockMdx } from "@repo/design-system/components/markdown/code/block";
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
import { MermaidMdx } from "@repo/design-system/components/markdown/mermaid";
import { Youtube } from "@repo/design-system/components/markdown/youtube";
import { baseComponentNames } from "@repo/design-system/lib/markdown/names";
import { semanticMdxComponents } from "@repo/design-system/lib/markdown/semantic";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Shared semantic and visual component registry for every Nakafa MDX renderer. */
export const mdxComponents = {
  ...semanticMdxComponents,
  [baseComponentNames.codeBlock]: CodeBlockMdx,
  [baseComponentNames.youtube]: Youtube,
  [baseComponentNames.mermaid]: MermaidMdx,
  [baseComponentNames.mathContainer]: MathContainer,
  [baseComponentNames.inlineMath]: InlineMath,
  [baseComponentNames.blockMath]: BlockMath,
  [baseComponentNames.agentContext]: AgentContext,
  [baseComponentNames.contentBlock]: ContentBlock,
  [baseComponentNames.contentStack]: ContentStack,
  [baseComponentNames.contentGrid]: ContentGrid,
} satisfies MDXComponents;
