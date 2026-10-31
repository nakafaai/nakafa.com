import type {
  BlockNode,
  ListItemNode,
  TableRowNode,
} from "@nakafa/aksara-contracts/assessment/document";
import type {
  InlineNode,
  Mark,
} from "@nakafa/aksara-contracts/assessment/inline";
import { Array as Arr, Match, String as Str } from "effect";

/** Where an answer field sits inside a line, which the agent reads as a blank to fill. */
const INLINE_ANSWER = "[blank]";

/** Where an interaction sits as a block of its own; its parts are listed beside the document. */
const BLOCK_ANSWER = "[answer]";

/**
 * Wraps text in one mark as Markdown writes it. Underline, subscript, and superscript have no
 * Markdown form, so their text stays as written.
 */
function markText(text: string, mark: Mark) {
  return Match.value(mark).pipe(
    Match.discriminatorsExhaustive("type")({
      bold: () => `**${text}**`,
      code: () => `\`${text}\``,
      italic: () => `_${text}_`,
      link: ({ attrs }) => `[${text}](${attrs.href})`,
      subscript: () => text,
      superscript: () => text,
      underline: () => text,
    })
  );
}

/** Writes the inline content of a paragraph or a heading as one Markdown line. */
function inlineText(nodes: readonly InlineNode[] | undefined) {
  return Arr.join(
    Arr.map(nodes ?? [], (node) =>
      Match.value(node).pipe(
        Match.discriminatorsExhaustive("type")({
          hardBreak: () => "\n",
          inlineInteraction: () => INLINE_ANSWER,
          mathInline: ({ attrs }) => `$${attrs.latex}$`,
          text: ({ marks, text }) => Arr.reduce(marks ?? [], text, markText),
        })
      )
    ),
    ""
  );
}

/** Indents every line after the first, so a block stays inside the list item it continues. */
function continueLines(text: string, indent: string) {
  return Arr.join(Str.split(text, "\n"), `\n${indent}`);
}

/** Writes one list item: its blocks, the first after the item's marker and the rest indented under it. */
function itemText(item: ListItemNode, marker: string) {
  return `${marker} ${continueLines(
    Arr.join(Arr.map(item.content, blockText), "\n\n"),
    " ".repeat(marker.length + 1)
  )}`;
}

/** Writes one table row as a Markdown row of its cells' text. */
function rowText(row: TableRowNode) {
  return `| ${Arr.join(
    Arr.map(row.content, (cell) =>
      Str.replaceAll("\n", " ")(Arr.join(Arr.map(cell.content, blockText), " "))
    ),
    " | "
  )} |`;
}

/** Writes one block of a document as Markdown. */
function blockText(block: BlockNode): string {
  return Match.value(block).pipe(
    Match.discriminatorsExhaustive("type")({
      blockquote: ({ content }) =>
        Arr.join(
          Arr.map(
            Str.split(Arr.join(Arr.map(content, blockText), "\n\n"), "\n"),
            (line) => (Str.isEmpty(line) ? ">" : `> ${line}`)
          ),
          "\n"
        ),
      bulletList: ({ content }) =>
        Arr.join(
          Arr.map(content, (item) => itemText(item, "-")),
          "\n"
        ),
      codeBlock: ({ attrs, content }) =>
        `\`\`\`${attrs.language ?? ""}\n${Arr.join(
          Arr.map(content ?? [], ({ text }) => text),
          ""
        )}\n\`\`\``,
      figure: ({ attrs }) => `[Figure: ${attrs.alt}]`,
      heading: ({ attrs, content }) =>
        `${"#".repeat(attrs.level)} ${inlineText(content)}`,
      image: ({ attrs }) => `[Image: ${attrs.alt}]`,
      interaction: () => BLOCK_ANSWER,
      mathBlock: ({ attrs }) => `$$\n${attrs.latex}\n$$`,
      orderedList: ({ attrs, content }) =>
        Arr.join(
          Arr.map(content, (item, index) =>
            itemText(item, `${attrs.start + index}.`)
          ),
          "\n"
        ),
      paragraph: ({ content }) => inlineText(content),
      table: ({ content }) => {
        const [first, ...rest] = content;
        const columns = first.content.length;
        return Arr.join(
          [
            rowText(first),
            `| ${Arr.join(
              Arr.makeBy(columns, () => "---"),
              " | "
            )} |`,
            ...Arr.map(rest, rowText),
          ],
          "\n"
        );
      },
    })
  );
}

/**
 * Writes an assessment document as Markdown an agent reads: its blocks in reading order, math as
 * LaTeX between dollar signs, an image or a figure by its required text alternative, and each place
 * an interaction sits as a marker, since its parts are listed beside the document.
 */
export function documentMarkdown(document: {
  readonly content: readonly BlockNode[];
}) {
  return Arr.join(Arr.map(document.content, blockText), "\n\n");
}
