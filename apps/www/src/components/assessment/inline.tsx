import type {
  InlineNode,
  Mark,
} from "@nakafa/aksara-contracts/assessment/inline";
import { Anchor } from "@repo/design-system/components/markdown/anchor";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  MdxCode,
  MdxEmphasis,
  MdxStrong,
  MdxSubscript,
  MdxSuperscript,
} from "@repo/design-system/components/markdown/mdx";
import { Array as Arr, Match } from "effect";
import type { ReactNode } from "react";
import { placeNodes } from "@/components/assessment/place";

/**
 * The inline content of one block, or the rich text of a figure's title, label, or caption: text with
 * its marks, inline math, and line breaks. The place of an inline interaction draws nothing, because
 * the question draws the interaction's fields below its prompt.
 */
export function InlineContent({
  nodes,
}: {
  readonly nodes: readonly InlineNode[] | undefined;
}) {
  return Arr.map(placeNodes(nodes ?? []), ({ key, node }) => (
    <InlinePiece key={key} node={node} />
  ));
}

/** One inline node of a document. */
function InlinePiece({ node }: { readonly node: InlineNode }) {
  return Match.value(node).pipe(
    Match.discriminatorsExhaustive("type")({
      hardBreak: () => <br />,
      inlineInteraction: () => null,
      mathInline: ({ attrs }) => <InlineMath math={attrs.latex} />,
      text: ({ marks, text }) => <MarkedText marks={marks ?? []} text={text} />,
    })
  );
}

/** A run of text inside its marks, the first mark outermost, as the document lists them. */
function MarkedText({
  marks,
  text,
}: {
  readonly marks: readonly Mark[];
  readonly text: string;
}): ReactNode {
  const [mark, ...inner] = marks;
  if (mark === undefined) {
    return text;
  }
  return (
    <TextMark mark={mark}>
      <MarkedText marks={inner} text={text} />
    </TextMark>
  );
}

/** One mark around the text it holds. */
function TextMark({
  children,
  mark,
}: {
  readonly children: ReactNode;
  readonly mark: Mark;
}) {
  return Match.value(mark).pipe(
    Match.discriminatorsExhaustive("type")({
      bold: () => <MdxStrong>{children}</MdxStrong>,
      code: () => <MdxCode>{children}</MdxCode>,
      italic: () => <MdxEmphasis>{children}</MdxEmphasis>,
      link: ({ attrs }) => <Anchor href={attrs.href}>{children}</Anchor>,
      subscript: () => <MdxSubscript>{children}</MdxSubscript>,
      superscript: () => <MdxSuperscript>{children}</MdxSuperscript>,
      underline: () => <u>{children}</u>,
    })
  );
}
