import { Array as Arr, HashSet, Option } from "effect";
import {
  isCallExpression,
  isIdentifier,
  isJsxElement,
  isJsxText,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isStringLiteralLikeNode,
  type JsxAttributes,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import {
  attributeValue,
  classText,
  judgesMarkup,
  opening,
} from "#scripts/check/jsx";
import { children } from "#scripts/check/source";

/** What draws a button: the component, the one inside an input, or the classes that make a link look like one. */
const BUTTON_TAGS = HashSet.make("Button", "InputGroupButton");
const BUTTON_CLASSES = "buttonVariants";
/** The trigger whose `render` names the element a Tooltip opens from. */
const TOOLTIP_TRIGGER_TAG = "TooltipTrigger";
const ICON_SIZE_PATTERN = /^icon/u;
/** What draws an icon alone: a Hugeicons icon, a spinner, an icon component, or an SVG. */
const ICON_TAG_PATTERN = /^(?:HugeIcons|Spinner|svg|[A-Z]\w*Icon)$/u;
/** A height or a square under the small button's, which a finger cannot press and a row cannot match. */
const SMALL_HEIGHT_PATTERN =
  /(?:^|\s|:)(?:h|size|min-h)-(?:[0-7](?:\.5)?|px)(?=\s|$)/u;

/**
 * Whether an element answers for an icon alone: an icon size, whose type requires the tooltip, or a tooltip of its
 * own on a button of another size, such as an icon with a caret.
 */
function namesIconSize(attributes: JsxAttributes) {
  return (
    Option.isSome(attributeValue(attributes, "tooltip")) ||
    Option.exists(
      attributeValue(attributes, "size"),
      (size) =>
        isStringLiteralLikeNode(size) && ICON_SIZE_PATTERN.test(size.text)
    )
  );
}

/** Whether what an element holds is icons alone, so it reads as an icon button. */
function holdsIconsAlone(element: Node) {
  if (!isJsxElement(element)) {
    return false;
  }
  const held = Arr.filter(
    element.children,
    (child) => !(isJsxText(child) && child.text.trim() === "")
  );
  return (
    Arr.isReadonlyArrayNonEmpty(held) &&
    Arr.every(held, (child) =>
      Option.exists(
        opening(child),
        ({ tag }) => tag !== undefined && ICON_TAG_PATTERN.test(tag)
      )
    )
  );
}

/** The Button a trigger renders, when its `render` names one. */
function renderedButton(attributes: JsxAttributes) {
  return Option.flatMap(attributeValue(attributes, "render"), (render) =>
    Option.filter(
      opening(render),
      ({ tag }) => tag !== undefined && HashSet.has(BUTTON_TAGS, tag)
    )
  );
}

/** Whether a node calls `buttonVariants` with an icon size. */
function iconClasses(node: Node) {
  if (
    !(
      isCallExpression(node) &&
      isIdentifier(node.expression) &&
      node.expression.text === BUTTON_CLASSES
    )
  ) {
    return false;
  }
  const [options] = node.arguments;
  return (
    options !== undefined &&
    isObjectLiteralExpression(options) &&
    Arr.some(
      options.properties,
      (property) =>
        isPropertyAssignment(property) &&
        isIdentifier(property.name) &&
        property.name.text === "size" &&
        isStringLiteralLikeNode(property.initializer) &&
        ICON_SIZE_PATTERN.test(property.initializer.text)
    )
  );
}

/** Every icon-sized `buttonVariants` call below a node that no TooltipTrigger renders. */
function untippedIconLinks(node: Node): readonly Node[] {
  return Arr.flatMap(children(node), (child) => {
    const tipped = Option.exists(
      opening(child),
      ({ tag }) => tag === TOOLTIP_TRIGGER_TAG
    );
    if (tipped) {
      return [];
    }
    return iconClasses(child)
      ? Arr.prepend(untippedIconLinks(child), child)
      : untippedIconLinks(child);
  });
}

/**
 * Reports a button that does not look and read like a Nakafa button. A button that holds an icon alone takes an
 * icon size, whose type requires the tooltip that names it, whether it holds the icon itself or a trigger renders it
 * around the icon. A button keeps to the design system's size scale, so no class sets a height under the small
 * button's. A link drawn as an icon button cannot carry a tooltip of its own, so a TooltipTrigger renders it. The
 * component sets that a registry ships keep their upstream shape.
 */
export function inspectButtonSource(file: string, sourceFile: SourceFile) {
  if (!judgesMarkup(file)) {
    return [];
  }
  const nodes = nodesBelow(sourceFile);
  const findings = Arr.flatMap(nodes, (node) =>
    Option.match(opening(node), {
      onNone: () => [],
      onSome: ({ attributes, tag }) => {
        const isButton = tag !== undefined && HashSet.has(BUTTON_TAGS, tag);
        const bareIcon =
          (isButton && holdsIconsAlone(node) && !namesIconSize(attributes)) ||
          Option.exists(
            renderedButton(attributes),
            (button) =>
              holdsIconsAlone(node) && !namesIconSize(button.attributes)
          );
        const small =
          isButton &&
          Option.exists(classText(attributes), (classes) =>
            SMALL_HEIGHT_PATTERN.test(classes)
          );
        return Arr.flatten([
          bareIcon
            ? [
                `${file}: a button holds an icon alone without a tooltip. An icon button takes size="icon" or size="icon-sm" and the tooltip that names its action.`,
              ]
            : [],
          small
            ? [
                `${file}: a button sets a height under the small button's. Buttons keep to the design system's size scale: use size="sm" or size="icon-sm", never a smaller class.`,
              ]
            : [],
        ]);
      },
    })
  );
  return Arr.appendAll(
    findings,
    Arr.map(
      untippedIconLinks(sourceFile),
      () =>
        `${file}: a link drawn as an icon button has no tooltip. Render it from a TooltipTrigger with a TooltipContent that names where it goes.`
    )
  );
}
