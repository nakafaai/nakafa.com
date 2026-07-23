/** Canonical component names shared by the base registry and renderer manifest. */
export const baseComponentNames = {
  agentContext: "AgentContext",
  anchor: "a",
  blockMath: "BlockMath",
  blockquote: "blockquote",
  code: "code",
  codeBlock: "CodeBlock",
  contentBlock: "ContentBlock",
  contentGrid: "ContentGrid",
  contentStack: "ContentStack",
  emphasis: "em",
  heading1: "h1",
  heading2: "h2",
  heading3: "h3",
  heading4: "h4",
  heading5: "h5",
  heading6: "h6",
  inlineMath: "InlineMath",
  listItem: "li",
  mathContainer: "MathContainer",
  mermaid: "Mermaid",
  orderedList: "ol",
  paragraph: "p",
  pre: "pre",
  strong: "strong",
  subscript: "sub",
  superscript: "sup",
  table: "table",
  tableBody: "tbody",
  tableCell: "td",
  tableHead: "th",
  tableHeader: "thead",
  tableRow: "tr",
  unorderedList: "ul",
  youtube: "Youtube",
} as const;

/** Canonical rich component names owned by chemistry routes. */
export const chemistryComponentNames = {
  atomShellLab: "AtomShellLab",
} as const;

/** Canonical rich component names owned by mathematics routes. */
export const mathematicsComponentNames = {
  functionMachine: "FunctionMachine",
} as const;
