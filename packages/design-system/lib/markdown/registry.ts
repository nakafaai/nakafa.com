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
import { baseComponentNames } from "@repo/design-system/lib/markdown/names";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Shared semantic and visual component registry for every Nakafa MDX renderer. */
export const mdxComponents = {
  [baseComponentNames.heading1]: MdxHeading1,
  [baseComponentNames.heading2]: MdxHeading2,
  [baseComponentNames.heading3]: MdxHeading3,
  [baseComponentNames.heading4]: MdxHeading4,
  [baseComponentNames.heading5]: MdxHeading5,
  [baseComponentNames.heading6]: MdxHeading6,
  [baseComponentNames.paragraph]: Paragraph,
  [baseComponentNames.orderedList]: MdxOrderedList,
  [baseComponentNames.unorderedList]: MdxUnorderedList,
  [baseComponentNames.listItem]: MdxListItem,
  [baseComponentNames.emphasis]: MdxEmphasis,
  [baseComponentNames.strong]: MdxStrong,
  [baseComponentNames.blockquote]: MdxBlockquote,
  [baseComponentNames.anchor]: Anchor,
  [baseComponentNames.codeBlock]: CodeBlockMdx,
  [baseComponentNames.code]: MdxCode,
  [baseComponentNames.youtube]: Youtube,
  [baseComponentNames.mermaid]: MermaidMdx,
  [baseComponentNames.mathContainer]: MathContainer,
  [baseComponentNames.inlineMath]: InlineMath,
  [baseComponentNames.blockMath]: BlockMath,
  [baseComponentNames.agentContext]: AgentContext,
  [baseComponentNames.contentBlock]: ContentBlock,
  [baseComponentNames.contentStack]: ContentStack,
  [baseComponentNames.contentGrid]: ContentGrid,
  [baseComponentNames.table]: MdxTable,
  [baseComponentNames.tableHeader]: MdxTableHeader,
  [baseComponentNames.tableBody]: MdxTableBody,
  [baseComponentNames.tableRow]: MdxTableRow,
  [baseComponentNames.tableHead]: MdxTableHead,
  [baseComponentNames.tableCell]: MdxTableCell,
  [baseComponentNames.pre]: MdxPre,
  [baseComponentNames.superscript]: MdxSuperscript,
  [baseComponentNames.subscript]: MdxSubscript,
} satisfies MDXComponents;
