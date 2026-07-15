import { AgentContext } from "@repo/design-system/components/markdown/agent-context";
import { Anchor } from "@repo/design-system/components/markdown/anchor";
import { CodeBlockMdx } from "@repo/design-system/components/markdown/code-block";
import {
  BlockMath,
  InlineMath,
  MathContainer,
} from "@repo/design-system/components/markdown/math";
import {
  ContentBlock,
  ContentGrid,
  ContentStack,
  MdxBlockquote,
  MdxCode,
  MdxEmphasis,
  MdxHeading1,
  MdxHeading2,
  MdxHeading3,
  MdxHeading4,
  MdxHeading5,
  MdxHeading6,
  MdxListItem,
  MdxOrderedList,
  MdxPre,
  MdxStrong,
  MdxSubscript,
  MdxSuperscript,
  MdxTable,
  MdxTableBody,
  MdxTableCell,
  MdxTableHead,
  MdxTableHeader,
  MdxTableRow,
  MdxUnorderedList,
} from "@repo/design-system/components/markdown/mdx";
import { MermaidMdx } from "@repo/design-system/components/markdown/mermaid";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import { Youtube } from "@repo/design-system/components/markdown/youtube";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Shared semantic and visual component registry for every Nakafa MDX renderer. */
export const mdxComponents = {
  h1: MdxHeading1,
  h2: MdxHeading2,
  h3: MdxHeading3,
  h4: MdxHeading4,
  h5: MdxHeading5,
  h6: MdxHeading6,
  p: Paragraph,
  ol: MdxOrderedList,
  ul: MdxUnorderedList,
  li: MdxListItem,
  em: MdxEmphasis,
  strong: MdxStrong,
  blockquote: MdxBlockquote,
  a: Anchor,
  CodeBlock: CodeBlockMdx,
  code: MdxCode,
  Youtube,
  Mermaid: MermaidMdx,
  MathContainer,
  InlineMath,
  BlockMath,
  AgentContext,
  ContentBlock,
  ContentStack,
  ContentGrid,
  table: MdxTable,
  thead: MdxTableHeader,
  tbody: MdxTableBody,
  tr: MdxTableRow,
  th: MdxTableHead,
  td: MdxTableCell,
  pre: MdxPre,
  sup: MdxSuperscript,
  sub: MdxSubscript,
} satisfies MDXComponents;
