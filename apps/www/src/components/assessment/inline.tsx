import type {
  InlineNode,
  Mark,
} from "@nakafa/aksara-contracts/assessment/inline";
import { Anchor } from "@repo/design-system/components/markdown/anchor";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  Highlight,
  MdxCode,
  MdxEmphasis,
  MdxStrong,
  MdxSubscript,
  MdxSuperscript,
} from "@repo/design-system/components/markdown/mdx";
import { Array as Arr, Match } from "effect";
import type { ReactNode } from "react";
import { AssessmentInteraction } from "@/components/assessment/interaction";
import { placeNodes } from "@/components/assessment/place";
import type { InlineLeaf, InlineRun } from "@/components/assessment/runs";
import { groupInlineNodes } from "@/components/assessment/runs";

/**
 * The inline content of one block, or the rich text of a figure's title, label, or caption: text with
 * its marks, inline math, and line breaks. Contiguous nodes sharing canonical marks render inside one
 * continuous wrapper so text and inline formulas share one unbroken highlight pill. The place of an
 * inline interaction draws its field inside the line when the question draws its fields at their places
 * (`AssessmentInteraction`), and nothing otherwise.
 */
export function InlineContent({
  nodes,
}: {
  readonly nodes: readonly InlineNode[] | undefined;
}) {
  return <InlineRuns runs={groupInlineNodes(nodes)} />;
}

/** A sequence of grouped inline runs in reading order. */
function InlineRuns({ runs }: { readonly runs: readonly InlineRun[] }) {
  return Arr.map(placeNodes(runs), ({ key, node }) => (
    <InlineRunNode key={key} run={node} />
  ));
}

/** One grouped inline run: either a leaf node or a shared mark around its child runs. */
function InlineRunNode({ run }: { readonly run: InlineRun }) {
  return Match.value(run).pipe(
    Match.discriminatorsExhaustive("kind")({
      leaf: ({ node }) => <InlinePiece node={node} />,
      mark: ({ children, mark }) => (
        <TextMark mark={mark}>
          <InlineRuns runs={children} />
        </TextMark>
      ),
    })
  );
}

/** One leaf inline node of a document. */
function InlinePiece({ node }: { readonly node: InlineLeaf }) {
  return Match.value(node).pipe(
    Match.discriminatorsExhaustive("type")({
      hardBreak: () => <br />,
      inlineInteraction: ({ interaction }) => (
        <AssessmentInteraction inline interaction={interaction} />
      ),
      mathInline: ({ latex }) => <InlineMath math={latex} />,
      text: ({ text }) => text,
    })
  );
}

/** One mark around the inline runs it holds. */
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
      highlight: ({ attrs }) => (
        <Highlight variant={attrs.variant ?? undefined}>{children}</Highlight>
      ),
      italic: () => <MdxEmphasis>{children}</MdxEmphasis>,
      link: ({ attrs }) => <Anchor href={attrs.href}>{children}</Anchor>,
      subscript: () => <MdxSubscript>{children}</MdxSubscript>,
      superscript: () => <MdxSuperscript>{children}</MdxSuperscript>,
      underline: () => <u>{children}</u>,
    })
  );
}
