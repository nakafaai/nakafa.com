import { Array as Arr, Option, Result } from "effect";
import {
  isIdentifier,
  isJsxAttribute,
  isJsxElement,
  isJsxExpression,
  isJsxSelfClosingElement,
  isLiteralLikeNode,
  type JsxAttributes,
  type Node,
} from "tsrs/ast";
import { nodesBelow, tagText } from "#scripts/check/drilling";
import { COMPONENT_SET_DIRECTORIES } from "#scripts/check/exports";

const JSX_MODULE_PATTERN = /\.tsx$/u;

/**
 * Whether the markup rules judge a module: a `.tsx` module outside the component sets that a registry ships, which
 * keep their upstream shape.
 */
export function judgesMarkup(file: string) {
  return (
    JSX_MODULE_PATTERN.test(file) &&
    !Arr.some(COMPONENT_SET_DIRECTORIES, (directory) =>
      file.startsWith(directory)
    )
  );
}

/** The tag and attributes of an element that a node opens, or none for any other node. */
export function opening(node: Node) {
  if (isJsxElement(node)) {
    return Option.some({
      attributes: node.openingElement.attributes,
      tag: tagText(node.openingElement.tagName),
    });
  }
  return isJsxSelfClosingElement(node)
    ? Option.some({ attributes: node.attributes, tag: tagText(node.tagName) })
    : Option.none();
}

/** The value an attribute holds: its expression in braces or its quoted text. */
export function attributeValue(attributes: JsxAttributes, name: string) {
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

/** The class text of an element's `className`: every literal it writes, in a string, a template or a call. */
export function classText(attributes: JsxAttributes) {
  return Option.map(attributeValue(attributes, "className"), (value) =>
    Arr.join(
      Arr.filterMap(Arr.prepend(nodesBelow(value), value), (node) =>
        isLiteralLikeNode(node) ? Result.succeed(node.text) : Result.failVoid
      ),
      " "
    )
  );
}
