import { Array as Arr, Option, Result } from "effect";
import {
  isFunctionDeclaration,
  isIdentifier,
  isJsxElement,
  isJsxExpression,
  isVariableDeclaration,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import { attributeValue, judgesMarkup, opening } from "#scripts/check/jsx";
import { place } from "#scripts/check/places";

const CARD_TAG = "VisualCard";
const HEADER_TAG = "VisualCardHeader";
const CHILDREN = "children";
const COMPONENT_PATTERN = /^[A-Z]/u;
/** What a visual's header names: the visual, and the one sentence that says what it shows. */
const HEADER_ATTRIBUTES = ["title", "description"];

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

/**
 * Reports a visual card that does not name what it shows. Every `VisualCard` holds a `VisualCardHeader`, and every
 * header takes its `title` and its `description`, so a reader knows what a visual shows before reading it. A frame
 * component whose card places its `children` takes the header from each caller in its module, which writes it there.
 */
export function inspectVisualSource(file: string, sourceFile: SourceFile) {
  if (!judgesMarkup(file)) {
    return [];
  }
  const nodes = nodesBelow(sourceFile);
  const headless = Arr.map(
    Arr.flatMap(nodes, (node) =>
      Option.exists(opening(node), ({ tag }) => tag === CARD_TAG)
        ? missingHeaders(node, nodes)
        : []
    ),
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
  return Arr.appendAll(headless, unnamed);
}
