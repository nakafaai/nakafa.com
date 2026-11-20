import { Array as Arr, HashSet, Option, Result } from "effect";
import {
  isJsxElement,
  isJsxExpression,
  isJsxSelfClosingElement,
  isJsxText,
  isStringLiteralLikeNode,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import { judgesMarkup, opening } from "#scripts/check/jsx";
import { place } from "#scripts/check/places";
import { children } from "#scripts/check/source";

/** The bands of a visual card that hold its controls: the toolbar above the visual and the actions under it. */
const CONTROL_BANDS = HashSet.make("VisualCardToolbar", "VisualCardActions");
/** An intrinsic element's tag starts lower case; a component's starts upper case. */
const INTRINSIC_TAG_PATTERN = /^[a-z]/u;
/** The intrinsic elements a reader operates. */
const INTRINSIC_CONTROLS = HashSet.make(
  "button",
  "input",
  "select",
  "textarea"
);
/** The intrinsic elements that set out text: a list, a paragraph, a term list, a caption, a table or a heading. */
const TEXT_ELEMENTS = HashSet.make(
  "blockquote",
  "caption",
  "dd",
  "dl",
  "dt",
  "figcaption",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "ol",
  "p",
  "small",
  "table",
  "ul"
);
/** The components that set out text wherever they stand: a legend, a caption, a note or a readout. */
const TEXT_BLOCK_PATTERN = /Legend|Caption|Note|Readout|Fact/u;
/** The components that show a few words or a formula and take no input, which name a control only beside it. */
const TEXT_ONLY_PATTERN = /^(?:InlineMath|BlockMath|Badge|Label|Kbd)$/u;
const BAND_RULE =
  "The toolbar and the actions band hold only the visual's controls and buttons, each with its own label and value: put a legend, a key, a readout or a note in VisualCardFooter, and what the reader should do in the header's description.";

/** The tag of an element, or none for any other node. */
function tagOf(node: Node) {
  return Option.flatMap(opening(node), ({ tag }) =>
    Option.fromUndefinedOr(tag)
  );
}

/** Whether a tag sets out text wherever it stands: a list, a paragraph, a table, or a legend, note or readout. */
function isTextBlock(tag: string) {
  return INTRINSIC_TAG_PATTERN.test(tag)
    ? HashSet.has(TEXT_ELEMENTS, tag)
    : TEXT_BLOCK_PATTERN.test(tag);
}

/** Whether a tag names an element a reader operates: a control component, or a button, field or choice. */
function isControl(tag: string) {
  return INTRINSIC_TAG_PATTERN.test(tag)
    ? HashSet.has(INTRINSIC_CONTROLS, tag)
    : !(TEXT_BLOCK_PATTERN.test(tag) || TEXT_ONLY_PATTERN.test(tag));
}

/** Whether a node is words in the markup: text between tags, or a quoted string in braces. */
function isWords(node: Node) {
  return (
    (isJsxText(node) && node.text.trim() !== "") ||
    (isJsxExpression(node) &&
      node.expression !== undefined &&
      isStringLiteralLikeNode(node.expression))
  );
}

/**
 * The items written in one place of a band: an element or words stand for themselves, and anything else, such as a
 * condition, a fragment or a list's callback, is read through to the items it renders.
 */
function itemsIn(node: Node): readonly Node[] {
  return isJsxElement(node) || isJsxSelfClosingElement(node) || isWords(node)
    ? [node]
    : Arr.flatMap(children(node), itemsIn);
}

/** The items a band holds itself, each element and run of words it renders directly. */
function bandItems(band: Node) {
  return isJsxElement(band) ? Arr.flatMap(band.children, itemsIn) : [];
}

/** Why a band may not hold an item that groups no control, or none for an item that does. */
function groupIssue(tag: string, item: Node): Option.Option<string> {
  if (!INTRINSIC_TAG_PATTERN.test(tag) || isControl(tag)) {
    return Option.none();
  }
  return Arr.some(nodesBelow(item), (node) =>
    Option.exists(tagOf(node), isControl)
  )
    ? Option.none()
    : Option.some(`holds <${tag}>, which holds no control`);
}

/** What is wrong with one item of a band: words in the band, a text element, or a group without a control. */
function itemIssue(item: Node): Option.Option<string> {
  return Option.match(tagOf(item), {
    onNone: () => Option.some("writes text straight into the band"),
    onSome: (tag) =>
      isTextBlock(tag) || TEXT_ONLY_PATTERN.test(tag)
        ? Option.some(`holds <${tag}>, which shows text and no control`)
        : groupIssue(tag, item),
  });
}

/** The text blocks inside an item, such as a legend list grouped with a set of toggles. */
function nestedIssues(item: Node) {
  return Arr.filterMap(nodesBelow(item), (node) =>
    Option.match(Option.filter(tagOf(node), isTextBlock), {
      onNone: () => Result.failVoid,
      onSome: (tag) =>
        Result.succeed({
          issue: `holds <${tag}>, which shows text and no control`,
          node,
        }),
    })
  );
}

/** The findings in one band: each item that is not a control, and each text block inside one that is. */
function bandIssues(band: Node) {
  return Arr.flatMap(bandItems(band), (item) =>
    Option.match(itemIssue(item), {
      onNone: () => nestedIssues(item),
      onSome: (issue) => [{ issue, node: item }],
    })
  );
}

/**
 * Reports text in a visual card's toolbar or actions band. Those bands hold only what the reader operates: toggles,
 * sliders with their label and value, fields, and buttons. A legend, a key, a readout or a note belongs in the
 * footer, and a task in the header's description, so the bands above and under the visual stay pure actions.
 */
export function inspectBandSource(file: string, sourceFile: SourceFile) {
  if (!judgesMarkup(file)) {
    return [];
  }
  return Arr.flatMap(nodesBelow(sourceFile), (band) =>
    Option.match(
      Option.filter(tagOf(band), (tag) => HashSet.has(CONTROL_BANDS, tag)),
      {
        onNone: () => [],
        onSome: (name) =>
          Arr.map(
            bandIssues(band),
            ({ issue, node }) =>
              `${place(file, sourceFile, node)}: a ${name} ${issue}. ${BAND_RULE}`
          ),
      }
    )
  );
}
