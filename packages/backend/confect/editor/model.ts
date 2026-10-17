import type {
  MarkTypeSchema,
  NodeTypeSchema,
} from "@repo/backend/confect/editor/node";
import {
  type MarkSpec,
  type NodeSpec,
  Schema as ProseSchema,
} from "prosemirror-model";

/** The node types of an assessment document: the types the editor reads, and the root `doc`. */
type ModelNodeType = typeof NodeTypeSchema.Type | "doc";

/** The mark types of an assessment document, in the order the contract writes them. */
type ModelMarkType = typeof MarkTypeSchema.Type;

/**
 * The node specs of an assessment document, written as the editor's schema writes them:
 * the content, the group, and the attributes with the defaults that ProseMirror applies
 * when a step leaves an attribute out (ADR 0028). The keys follow the editor's order,
 * because the order of the types decides which type a fill or a wrap picks. The design
 * system cannot import this package, so these specs are a second copy of the editor's,
 * which ADR 0028 accepts.
 */
const NODE_SPECS: Record<ModelNodeType, NodeSpec> = {
  paragraph: { content: "inline*", group: "block" },
  blockquote: { content: "block+", defining: true, group: "block" },
  bulletList: { content: "listItem+", group: "block list" },
  codeBlock: {
    attrs: { language: { default: null } },
    code: true,
    content: "text*",
    defining: true,
    group: "block",
    marks: "",
  },
  doc: { content: "block+" },
  hardBreak: {
    group: "inline",
    inline: true,
    linebreakReplacement: true,
    selectable: false,
  },
  heading: {
    attrs: { level: { default: 1 } },
    content: "inline*",
    defining: true,
    group: "block",
  },
  listItem: { content: "paragraph block*", defining: true },
  text: { group: "inline" },
  orderedList: {
    attrs: { start: { default: 1 } },
    content: "listItem+",
    group: "block list",
  },
};

/**
 * The mark specs of an assessment document, in the contract's order (`MarkTypeSchema`),
 * which the editor's schema takes too. A mark's rank is its place in this order, so a
 * text stores its marks in the order the contract accepts, and `model.test.ts` pins it.
 * A code mark excludes every other mark, and a link takes one attribute, its address,
 * which the contract names and the editor keeps (ADR 0028).
 */
const MARK_SPECS: Record<ModelMarkType, MarkSpec> = {
  bold: {},
  italic: {},
  underline: {},
  code: { code: true, excludes: "_" },
  subscript: {},
  superscript: {},
  link: { attrs: { href: { default: null } }, inclusive: true },
};

/**
 * The ProseMirror schema of an assessment document. The server applies the stored steps
 * with it, so a step makes the same document here as in the editor (ADR 0028).
 */
export const assessmentModel = new ProseSchema<ModelNodeType, ModelMarkType>({
  marks: MARK_SPECS,
  nodes: NODE_SPECS,
});
