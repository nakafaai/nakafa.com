import {
  Array as Arr,
  HashSet,
  Number as Num,
  Option,
  Record,
  Result,
} from "effect";
import {
  isIdentifier,
  isJsxAttribute,
  isJsxElement,
  isJsxExpression,
  isJsxSelfClosingElement,
  isLiteralLikeNode,
  isNumericLiteral,
  type JsxAttributes,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { nodesBelow, tagText } from "#scripts/check/drilling";

const SOURCE_PATTERN = /^(?:apps|packages)\/.+\.tsx?$/u;
/** The largest icon on Nakafa's scale, `size-4`, in Tailwind's steps and in pixels. */
const LARGEST_STEP = 4;
const LARGEST_PIXELS = 16;
/** What draws a Hugeicons icon: the design system's wrapper and the library's own component. */
const ICON_TAGS = HashSet.make("HugeIcons", "HugeiconsIcon");
/** The library's own component, which draws 24px unless told otherwise, and the one module that wraps it. */
const LIBRARY_TAG = "HugeiconsIcon";
const WRAPPER_MODULE = "packages/design-system/components/ui/huge-icons.tsx";
/** A square, a height or a width on Tailwind's scale, after any variant, which sizes the element itself. */
const ELEMENT_SIZE_PATTERN =
  /(?<=^|[\s:])(?<utility>(?:size|h|w)-(?<step>\d+(?:\.\d+)?))(?=[\s"'`]|$)/gu;
/** A square, a height or a width that a selector gives every SVG inside an element, such as `[&_svg]:size-5`. */
const SELECTOR_SIZE_PATTERN =
  /svg\S*?\]:(?<utility>(?:size|h|w)-(?<step>\d+(?:\.\d+)?))(?=[\s"'`]|$)/gu;

/** The utilities that a pattern finds in a class text above `size-4`, such as `size-6`. */
function oversized(pattern: RegExp, classes: string) {
  return Arr.filterMap(Arr.fromIterable(classes.matchAll(pattern)), (match) =>
    Option.match(
      Option.filter(
        Option.flatMap(Option.fromNullishOr(match.groups), (groups) =>
          Option.all({
            step: Option.flatMap(Record.get(groups, "step"), Num.parse),
            utility: Record.get(groups, "utility"),
          })
        ),
        ({ step }) => step > LARGEST_STEP
      ),
      {
        onNone: () => Result.failVoid,
        onSome: ({ utility }) => Result.succeed(utility),
      }
    )
  );
}

/** The tag and attributes of an element that a node opens, when it draws a Hugeicons icon. */
function iconElement(node: Node) {
  const opened = isJsxElement(node)
    ? Option.some({
        attributes: node.openingElement.attributes,
        tag: tagText(node.openingElement.tagName) ?? "",
      })
    : Option.none();
  const closed = isJsxSelfClosingElement(node)
    ? Option.some({
        attributes: node.attributes,
        tag: tagText(node.tagName) ?? "",
      })
    : Option.none();
  return Option.filter(
    Option.orElse(opened, () => closed),
    ({ tag }) => HashSet.has(ICON_TAGS, tag)
  );
}

/** The expression or quoted text that an attribute holds. */
function attributeValue(attributes: JsxAttributes, name: string) {
  return Arr.findFirst(attributes.properties, (property) =>
    isJsxAttribute(property) &&
    isIdentifier(property.name) &&
    property.name.text === name &&
    property.initializer !== undefined
      ? Option.some<Node>(
          isJsxExpression(property.initializer) &&
            property.initializer.expression !== undefined
            ? property.initializer.expression
            : property.initializer
        )
      : Option.none()
  );
}

/** Every literal text below a node and the node's own, joined, as a class name writes it. */
function literalText(node: Node) {
  return Arr.join(
    Arr.filterMap(Arr.prepend(nodesBelow(node), node), (below) =>
      isLiteralLikeNode(below) ? Result.succeed(below.text) : Result.failVoid
    ),
    " "
  );
}

/** What an icon element sets above `size-4`: its classes, and a `size` in pixels. */
function iconFindings(attributes: JsxAttributes) {
  const classes = Option.match(attributeValue(attributes, "className"), {
    onNone: () => [],
    onSome: (value) => oversized(ELEMENT_SIZE_PATTERN, literalText(value)),
  });
  const pixels = Option.match(attributeValue(attributes, "size"), {
    onNone: () => [],
    onSome: (value) =>
      isNumericLiteral(value) &&
      Option.exists(Num.parse(value.text), (pixels) => pixels > LARGEST_PIXELS)
        ? [`size={${value.text}}`]
        : [],
  });
  return Arr.appendAll(classes, pixels);
}

/**
 * Reports a Hugeicons icon drawn above `size-4`, Nakafa's one icon size and its largest: a class or a `size` on the
 * icon itself, or a selector that sizes every SVG inside an element. The design system's wrapper (`HugeIcons`) draws
 * `size-4` when nothing sizes it, and a smaller part may shrink it, so the library's own component, which draws 24px,
 * is drawn by that wrapper alone.
 */
export function inspectIconSource(file: string, sourceFile: SourceFile) {
  if (!SOURCE_PATTERN.test(file)) {
    return [];
  }
  const nodes = nodesBelow(sourceFile);
  const icons = Arr.filterMap(nodes, (node) =>
    Option.match(iconElement(node), {
      onNone: () => Result.failVoid,
      onSome: Result.succeed,
    })
  );
  const sized = Arr.flatMap(icons, ({ attributes }) =>
    iconFindings(attributes)
  );
  const bySelector = Arr.flatMap(nodes, (node) =>
    isLiteralLikeNode(node) ? oversized(SELECTOR_SIZE_PATTERN, node.text) : []
  );
  const library =
    file === WRAPPER_MODULE
      ? []
      : Arr.filter(icons, ({ tag }) => tag === LIBRARY_TAG);
  return Arr.flatten([
    Arr.map(
      Arr.appendAll(sized, bySelector),
      (found) =>
        `${file}: an icon is drawn at ${found}, above size-4. Every Hugeicons icon is size-4 at most: drop the class, or use size-4 or a smaller step.`
    ),
    Arr.map(
      library,
      () =>
        `${file}: an icon is drawn by HugeiconsIcon, which draws 24px. Draw it with HugeIcons from the design system, which draws size-4.`
    ),
  ]);
}
