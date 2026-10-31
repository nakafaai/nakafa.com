import type {
  BlockNode,
  AssessmentDocument as Document,
  ListItemNode,
  TableCellNode,
  TableRowNode,
} from "@nakafa/aksara-contracts/assessment/document";
import { CodeBlockMdx } from "@repo/design-system/components/markdown/code/client";
import { BlockMath } from "@repo/design-system/components/markdown/math";
import {
  MdxBlockquote,
  MdxHeading4,
  MdxHeading5,
  MdxHeading6,
  MdxListItem,
  MdxOrderedList,
  MdxTable,
  MdxTableBody,
  MdxTableCell,
  MdxTableHead,
  MdxTableHeader,
  MdxTableRow,
  MdxUnorderedList,
} from "@repo/design-system/components/markdown/mdx";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import { Array as Arr, Match, Schema } from "effect";
import { AssessmentFigure } from "@/components/assessment/figure";
import { InlineContent } from "@/components/assessment/inline";
import { placeNodes } from "@/components/assessment/place";

/**
 * How a block sits: a page gives each paragraph its own spacing, as an article's text, and a line
 * draws a paragraph as its text alone, as an option's label or a table cell reads.
 */
const FlowSchema = Schema.Literals(["line", "page"]);

/**
 * One published assessment document, a prompt, a reading, or an explanation, drawn as the article
 * reads: its paragraphs, headings, lists, tables, math, and figures. Nothing evaluates or loads: the
 * document is data the release verified, so the server draws the same page the browser keeps.
 */
export function AssessmentDocument({
  document,
  label,
}: {
  readonly document: Pick<Document, "content">;
  /** The accessible name of the document. */
  readonly label: string;
}) {
  return (
    <section aria-label={label}>
      <Blocks blocks={document.content} flow="page" />
    </section>
  );
}

/** A document that reads as one line, an option's label or a statement of a table. */
export function AssessmentLine({
  document,
}: {
  readonly document: Pick<Document, "content">;
}) {
  return <Blocks blocks={document.content} flow="line" />;
}

/** The blocks of one level of a document, in reading order. */
function Blocks({
  blocks,
  flow,
}: {
  readonly blocks: readonly BlockNode[];
  readonly flow: typeof FlowSchema.Type;
}) {
  return Arr.map(placeNodes(blocks), ({ key, node }) => (
    <Block block={node} flow={flow} key={key} />
  ));
}

/**
 * One block of a document. The place of an interaction draws nothing, because the question draws
 * the interaction's fields below its prompt. An image's file has no address a published try-out
 * names, so it reads as its text alternative.
 */
function Block({
  block,
  flow,
}: {
  readonly block: BlockNode;
  readonly flow: typeof FlowSchema.Type;
}) {
  return Match.value(block).pipe(
    Match.discriminatorsExhaustive("type")({
      blockquote: ({ content }) => (
        <MdxBlockquote>
          <Blocks blocks={content} flow="page" />
        </MdxBlockquote>
      ),
      bulletList: ({ content }) => (
        <MdxUnorderedList>
          <ListItems items={content} />
        </MdxUnorderedList>
      ),
      codeBlock: ({ attrs, content }) => (
        <CodeBlockMdx
          data={[
            {
              code: content?.[0].text ?? "",
              filename: attrs.language ?? "text",
              language: attrs.language ?? "text",
            },
          ]}
        />
      ),
      figure: ({ attrs }) => <AssessmentFigure attrs={attrs} />,
      heading: ({ attrs, content }) =>
        Match.value(attrs.level).pipe(
          Match.when(1, () => (
            <MdxHeading4>
              <InlineContent nodes={content} />
            </MdxHeading4>
          )),
          Match.when(2, () => (
            <MdxHeading5>
              <InlineContent nodes={content} />
            </MdxHeading5>
          )),
          Match.when(3, () => (
            <MdxHeading6>
              <InlineContent nodes={content} />
            </MdxHeading6>
          )),
          Match.exhaustive
        ),
      image: ({ attrs }) => <Paragraph>{attrs.alt}</Paragraph>,
      interaction: () => null,
      mathBlock: ({ attrs }) => <BlockMath math={attrs.latex} />,
      orderedList: ({ attrs, content }) => (
        <MdxOrderedList start={attrs.start}>
          <ListItems items={content} />
        </MdxOrderedList>
      ),
      paragraph: ({ content }) =>
        flow === "line" ? (
          <InlineContent nodes={content} />
        ) : (
          <Paragraph>
            <InlineContent nodes={content} />
          </Paragraph>
        ),
      table: ({ content }) => <Table rows={content} />,
    })
  );
}

/** The items of one list, each opening with its paragraph as a line. */
function ListItems({ items }: { readonly items: readonly ListItemNode[] }) {
  return Arr.map(placeNodes(items), ({ key, node }) => (
    <MdxListItem key={key}>
      <Blocks blocks={node.content} flow="line" />
    </MdxListItem>
  ));
}

/** One table: the rows of header cells it opens with as its header, and the rest as its body. */
function Table({ rows }: { readonly rows: readonly TableRowNode[] }) {
  const [header, body] = Arr.span(rows, (row) =>
    Arr.every(row.content, (cell) => cell.type === "tableHeader")
  );
  return (
    <MdxTable>
      {header.length === 0 ? null : (
        <MdxTableHeader>
          <TableRows rows={header} />
        </MdxTableHeader>
      )}
      <MdxTableBody>
        <TableRows rows={body} />
      </MdxTableBody>
    </MdxTable>
  );
}

/** The rows of one part of a table. */
function TableRows({ rows }: { readonly rows: readonly TableRowNode[] }) {
  return Arr.map(placeNodes(rows), ({ key, node }) => (
    <MdxTableRow key={key}>
      <TableCells cells={node.content} />
    </MdxTableRow>
  ));
}

/** The cells of one row, a header cell as a header and a body cell as data. */
function TableCells({ cells }: { readonly cells: readonly TableCellNode[] }) {
  return Arr.map(placeNodes(cells), ({ key, node }) =>
    node.type === "tableHeader" ? (
      <MdxTableHead
        colSpan={node.attrs.colspan}
        key={key}
        rowSpan={node.attrs.rowspan}
      >
        <Blocks blocks={node.content} flow="line" />
      </MdxTableHead>
    ) : (
      <MdxTableCell
        colSpan={node.attrs.colspan}
        key={key}
        rowSpan={node.attrs.rowspan}
      >
        <Blocks blocks={node.content} flow="line" />
      </MdxTableCell>
    )
  );
}
