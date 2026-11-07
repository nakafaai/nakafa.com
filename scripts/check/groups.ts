import { Array as Arr, Option } from "effect";
import {
  isCallExpression,
  isIdentifier,
  isJsxAttribute,
  isJsxElement,
  isJsxSelfClosingElement,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isStringLiteral,
  type JsxAttributes,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { tagText } from "#scripts/check/drilling";
import { COMPONENT_SET_DIRECTORIES } from "#scripts/check/exports";
import { children } from "#scripts/check/source";

const JSX_MODULE_PATTERN = /\.tsx$/u;
const GROUP_TAG = "ButtonGroup";
const BUTTON_TAG = "Button";
const BUTTON_CLASSES = "buttonVariants";
const VARIANT = "variant";
/** The variant a group gives its buttons when it names none, as `ButtonGroup` defaults it. */
const GROUP_DEFAULT_VARIANT = "outline";
/**
 * A popup of the design system starts outside any group, because each one resets the group's variant: what a menu,
 * a dialog or a sheet holds is not part of the row that opened it.
 */
const POPUP_TAG_PATTERN = /(?:Content|Popup)$|^ResponsiveDialog$/u;

/** The tag and attributes of an element that a node opens, or none for any other node. */
function opening(node: Node) {
  if (isJsxSelfClosingElement(node)) {
    return Option.some({
      attributes: node.attributes,
      tag: tagText(node.tagName),
    });
  }
  return isJsxElement(node)
    ? Option.some({
        attributes: node.openingElement.attributes,
        tag: tagText(node.openingElement.tagName),
      })
    : Option.none();
}

/** The one attribute of an element named `name`. */
function attribute(attributes: JsxAttributes, name: string) {
  return Arr.findFirst(
    attributes.properties,
    (property) =>
      isJsxAttribute(property) &&
      isIdentifier(property.name) &&
      property.name.text === name
  );
}

/**
 * The variant a group names: its literal, the default when it names none, or none when the group's variant is an
 * expression, which a group never takes.
 */
function groupVariant(attributes: JsxAttributes) {
  return Option.match(attribute(attributes, VARIANT), {
    onNone: () => Option.some(GROUP_DEFAULT_VARIANT),
    onSome: (variant) =>
      isJsxAttribute(variant) &&
      variant.initializer !== undefined &&
      isStringLiteral(variant.initializer)
        ? Option.some(variant.initializer.text)
        : Option.none(),
  });
}

/**
 * Every node that stands in a group's row, in source order: what its children hold, the attributes of their elements
 * included, down to a popup or a group of its own, which stand outside the row.
 */
function rowNodes(node: Node): readonly Node[] {
  return Arr.flatMap(children(node), (child) =>
    Option.match(opening(child), {
      onNone: () => Arr.prepend(rowNodes(child), child),
      onSome: ({ tag }) =>
        tag === GROUP_TAG || (tag !== undefined && POPUP_TAG_PATTERN.test(tag))
          ? []
          : Arr.prepend(rowNodes(child), child),
    })
  );
}

/** The variant that a `buttonVariants({ variant })` call names, when it names one in a literal. */
function classVariant(node: Node) {
  if (
    !(
      isCallExpression(node) &&
      isIdentifier(node.expression) &&
      node.expression.text === BUTTON_CLASSES
    )
  ) {
    return Option.none();
  }
  const [options] = node.arguments;
  return Option.some(
    options !== undefined && isObjectLiteralExpression(options)
      ? Arr.findFirst(options.properties, (property) =>
          isPropertyAssignment(property) &&
          isIdentifier(property.name) &&
          property.name.text === VARIANT &&
          isStringLiteral(property.initializer)
            ? Option.some(property.initializer.text)
            : Option.none()
        )
      : Option.none<string>()
  );
}

/** Reports how one group falls short of a single variant. */
function inspectGroup(file: string, group: Node, attributes: JsxAttributes) {
  return Option.match(groupVariant(attributes), {
    onNone: () => [
      `${file}: a ButtonGroup's variant changes with an expression. A group holds one variant that never switches with state: name it, such as variant="outline", and let a pressed part say so with aria-pressed.`,
    ],
    onSome: (variant) =>
      Arr.flatMap(rowNodes(group), (node) => {
        const buttons = Option.match(opening(node), {
          onNone: () => [],
          onSome: ({ attributes: own, tag }) =>
            tag === BUTTON_TAG && Option.isSome(attribute(own, VARIANT))
              ? [
                  `${file}: a Button inside a ButtonGroup names its own variant. The group gives every button its one variant, and the page's primary stands outside it: remove the Button's variant, or move the primary out of the group.`,
                ]
              : [],
        });
        const links = Option.match(classVariant(node), {
          onNone: () => [],
          onSome: (named) =>
            Option.contains(named, variant)
              ? []
              : [
                  `${file}: a link inside a ButtonGroup draws another variant than the group's. A group holds one variant: write buttonVariants({ variant: "${variant}" }).`,
                ],
        });
        return Arr.appendAll(buttons, links);
      }),
  });
}

/**
 * Reports the ways a ButtonGroup falls short of one variant. The group gives every `Button` inside it the variant it
 * names, outline unless it says otherwise, so a part that names its own variant only says something untrue: a
 * filled primary inside a group, or a part whose variant switches with its state. A link drawn with `buttonVariants`
 * cannot read the group, so it names the group's variant itself. A popup that the row opens starts outside the row,
 * as at run time. The component sets that a registry ships keep their upstream shape.
 */
export function inspectGroupSource(file: string, sourceFile: SourceFile) {
  if (
    !JSX_MODULE_PATTERN.test(file) ||
    Arr.some(COMPONENT_SET_DIRECTORIES, (directory) =>
      file.startsWith(directory)
    )
  ) {
    return [];
  }
  return Arr.flatMap(groupsBelow(sourceFile), ({ attributes, group }) =>
    inspectGroup(file, group, attributes)
  );
}

/** Every group of a module, outer and nested alike, with the attributes of its opening tag. */
function groupsBelow(node: Node): readonly {
  readonly attributes: JsxAttributes;
  readonly group: Node;
}[] {
  return Arr.flatMap(children(node), (child) => {
    const below = groupsBelow(child);
    return Option.match(opening(child), {
      onNone: () => below,
      onSome: ({ attributes, tag }) =>
        tag === GROUP_TAG && isJsxElement(child)
          ? Arr.prepend(below, { attributes, group: child })
          : below,
    });
  });
}
