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
  type JsxAttributes,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { nodesBelow, tagText } from "#scripts/check/drilling";

const SOURCE_PATTERN = /^(?:apps|packages)\/.+\.tsx?$/u;
/** The largest icon on Nakafa's scale, `size-4`, in Tailwind's steps; a part may shrink its icons below it. */
const LARGEST_STEP = 4;
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

/** The utilities that a pattern finds in a class text whose step passes `keep`, such as `size-6`. */
function sizes(
  pattern: RegExp,
  classes: string,
  keep: (step: number) => boolean
) {
  return Arr.filterMap(Arr.fromIterable(classes.matchAll(pattern)), (match) =>
    Option.match(
      Option.filter(
        Option.flatMap(Option.fromNullishOr(match.groups), (groups) =>
          Option.all({
            step: Option.flatMap(Record.get(groups, "step"), Num.parse),
            utility: Record.get(groups, "utility"),
          })
        ),
        ({ step }) => keep(step)
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

/** The sizes an icon element's own classes give it, which the wrapper alone decides. */
function ownSizes(attributes: JsxAttributes) {
  return Option.match(attributeValue(attributes, "className"), {
    onNone: () => [],
    onSome: (value) =>
      sizes(ELEMENT_SIZE_PATTERN, literalText(value), () => true),
  });
}

/**
 * Reports a Hugeicons icon that is not drawn at `size-4`, Nakafa's one icon size: a size class on the icon itself, a
 * selector that sizes the SVGs inside an element above `size-4`, or the library's own component, which draws 24px.
 * The design system's wrapper (`HugeIcons`) draws every icon at `size-4` and takes no size from its caller; only a
 * part, such as a checkbox's tick, shrinks the icons inside it with a selector.
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
  const own = Arr.flatMap(icons, ({ attributes }) => ownSizes(attributes));
  const bySelector = Arr.flatMap(nodes, (node) =>
    isLiteralLikeNode(node)
      ? sizes(SELECTOR_SIZE_PATTERN, node.text, (step) => step > LARGEST_STEP)
      : []
  );
  const library =
    file === WRAPPER_MODULE
      ? []
      : Arr.filter(icons, ({ tag }) => tag === LIBRARY_TAG);
  return Arr.flatten([
    Arr.map(
      own,
      (found) =>
        `${file}: an icon sets its own size, ${found}. HugeIcons draws every icon at size-4: drop the class, and let a design-system part shrink the icons inside it with a selector.`
    ),
    Arr.map(
      bySelector,
      (found) =>
        `${file}: a selector draws icons at ${found}, above size-4. Every Hugeicons icon is size-4 at most: use size-4 or a smaller step.`
    ),
    Arr.map(
      library,
      () =>
        `${file}: an icon is drawn by HugeiconsIcon, which draws 24px. Draw it with HugeIcons from the design system, which draws size-4.`
    ),
  ]);
}
