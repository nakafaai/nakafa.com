import { Array as Arr, HashSet, Option, Result } from "effect";
import type { Node, SourceFile } from "tsrs/ast";
import {
  isFunctionDeclaration,
  isIdentifier,
  isJsxElement,
  isJsxExpression,
  isJsxText,
  isStringLiteralLikeNode,
  isVariableDeclaration,
} from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import { attributeValue, judgesMarkup, opening } from "#scripts/check/jsx";
import { place } from "#scripts/check/places";

const CARD_TAG = "VisualCard";
const HEADER_TAG = "VisualCardHeader";
const FOOTER_TAG = "VisualCardFooter";
const FOOTER_BANDS = HashSet.make("VisualCardFooter", "VisualCardTable");
const BANNED_NOTE_TAGS = HashSet.make(
  "VisualCardNote",
  "VisualCardNoteProvider"
);
const CHILDREN = "children";
const COMPONENT_PATTERN = /^[A-Z]/u;
/** What a visual's header names: the visual, and the one sentence that says what it shows. */
const HEADER_ATTRIBUTES = ["title", "description"];
const FOOTER_RULE =
  "A VisualCard may hold at most one footer band (VisualCardFooter with structured key-value VisualCardFacts, or VisualCardTable), never stacked double footers, VisualCardNote, or plain-text paragraphs.";

/** The headers among some nodes, each with its attributes. */
function headers(nodes: readonly Node[]) {
  return Arr.filterMap(nodes, (node) =>
    Option.match(opening(node), {
      onNone: () => Result.failVoid,
      onSome: ({ attributes, tag }) =>
        tag === HEADER_TAG
          ? Result.succeed({ attributes, node })
          : Result.failVoid,
    })
  );
}

/** Whether an element holds a header anywhere below it. */
function holdsHeader(node: Node) {
  return Arr.isReadonlyArrayNonEmpty(headers(nodesBelow(node)));
}

/** Whether a card places its caller's `children` among its own, as a frame whose callers write its header. */
function placesChildren(card: Node) {
  return (
    isJsxElement(card) &&
    Arr.some(
      card.children,
      (child) =>
        isJsxExpression(child) &&
        child.expression !== undefined &&
        isIdentifier(child.expression) &&
        child.expression.text === CHILDREN
    )
  );
}

/** The name of the component that a node stands in: the nearest function or variable named with a capital. */
function componentOf(node: Node): Option.Option<string> {
  const { parent } = node;
  if (parent === undefined) {
    return Option.none();
  }
  if (
    (isFunctionDeclaration(parent) || isVariableDeclaration(parent)) &&
    parent.name !== undefined &&
    isIdentifier(parent.name) &&
    COMPONENT_PATTERN.test(parent.name.text)
  ) {
    return Option.some(parent.name.text);
  }
  return componentOf(parent);
}

/**
 * The places where a card leaves its header unwritten: the card itself, or, for a frame that places its caller's
 * children, each usage of the frame in this module that writes no header among them, and the card when no usage does.
 */
function missingHeaders(card: Node, nodes: readonly Node[]): readonly Node[] {
  if (holdsHeader(card)) {
    return [];
  }
  if (!placesChildren(card)) {
    return [card];
  }
  const usages = Option.match(componentOf(card), {
    onNone: () => [],
    onSome: (frame) =>
      Arr.filter(nodes, (node) =>
        Option.exists(opening(node), ({ tag }) => tag === frame)
      ),
  });
  return Arr.isReadonlyArrayNonEmpty(usages)
    ? Arr.filter(usages, (usage) => !holdsHeader(usage))
    : [card];
}

/** Whether `node` sits directly inside `card` with no inner `VisualCard` between them. */
function ownedByCard(node: Node, card: Node): boolean {
  let cursor = node.parent;
  while (cursor !== undefined && cursor !== card) {
    if (Option.exists(opening(cursor), ({ tag }) => tag === CARD_TAG)) {
      return false;
    }
    cursor = cursor.parent;
  }
  return cursor === card;
}

/** Footer bands (`VisualCardFooter` or `VisualCardTable`) owned directly by one card. */
function ownedFooterBands(card: Node) {
  return Arr.filter(
    nodesBelow(card),
    (node) =>
      node !== card &&
      Option.exists(opening(node), ({ tag }) =>
        HashSet.has(FOOTER_BANDS, tag)
      ) &&
      ownedByCard(node, card)
  );
}

/** Whether a node writes plain text directly inside a `VisualCardFooter`. */
function isDirectFooterWords(node: Node): boolean {
  return (
    (isJsxText(node) && node.text.trim() !== "") ||
    (isJsxExpression(node) &&
      node.expression !== undefined &&
      isStringLiteralLikeNode(node.expression))
  );
}

/** Reports banned plain-text paragraphs or direct text inside one `VisualCardFooter`. */
function plainTextFooterNodes(footer: Node): readonly Node[] {
  const paragraphs = Arr.filter(nodesBelow(footer), (node) =>
    Option.exists(opening(node), ({ tag }) => tag === "p")
  );
  const words = isJsxElement(footer)
    ? Arr.filter(footer.children, isDirectFooterWords)
    : [];
  return Arr.appendAll(paragraphs, words);
}

/**
 * Reports visual card structural violations: missing headers/titles/descriptions,
 * banned `VisualCardNote`/`VisualCardNoteProvider`, stacked double footer bands,
 * and plain-text paragraphs inside `VisualCardFooter`.
 */
export function inspectVisualSource(file: string, sourceFile: SourceFile) {
  if (!judgesMarkup(file)) {
    return [];
  }
  const nodes = nodesBelow(sourceFile);
  const cards = Arr.filter(nodes, (node) =>
    Option.exists(opening(node), ({ tag }) => tag === CARD_TAG)
  );
  const headless = Arr.map(
    Arr.flatMap(cards, (card) => missingHeaders(card, nodes)),
    (node) =>
      `${place(file, sourceFile, node)}: a VisualCard has no VisualCardHeader. Every visual names what it shows: draw a VisualCardHeader with its title and description first in the card, or in what a frame that places its children receives.`
  );
  const unnamed = Arr.flatMap(headers(nodes), ({ attributes, node }) =>
    Arr.filterMap(HEADER_ATTRIBUTES, (name) =>
      Option.isNone(attributeValue(attributes, name))
        ? Result.succeed(
            `${place(file, sourceFile, node)}: a VisualCardHeader has no ${name}. Every visual's header takes its title and its description.`
          )
        : Result.failVoid
    )
  );
  const notes = Arr.filterMap(nodes, (node) =>
    Option.match(opening(node), {
      onNone: () => Result.failVoid,
      onSome: ({ tag }) =>
        HashSet.has(BANNED_NOTE_TAGS, tag)
          ? Result.succeed(
              `${place(file, sourceFile, node)}: <${tag}> is banned. ${FOOTER_RULE}`
            )
          : Result.failVoid,
    })
  );
  const doubleFooters = Arr.flatMap(cards, (card) =>
    Arr.map(
      Arr.drop(ownedFooterBands(card), 1),
      (band) =>
        `${place(file, sourceFile, band)}: a VisualCard has multiple footer bands. ${FOOTER_RULE}`
    )
  );
  const footers = Arr.filter(nodes, (node) =>
    Option.exists(opening(node), ({ tag }) => tag === FOOTER_TAG)
  );
  const plainFooters = Arr.flatMap(footers, (footer) =>
    Arr.map(
      plainTextFooterNodes(footer),
      (node) =>
        `${place(file, sourceFile, node)}: a VisualCardFooter holds plain text instead of structured key-value VisualCardFacts. ${FOOTER_RULE}`
    )
  );
  return Arr.flatten([headless, unnamed, notes, doubleFooters, plainFooters]);
}
