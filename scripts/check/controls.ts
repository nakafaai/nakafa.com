import { Array as Arr, HashMap, Option } from "effect";
import {
  isIdentifier,
  isJsxAttribute,
  isJsxElement,
  isJsxSelfClosingElement,
  isStringLiteral,
  type JsxAttributes,
  type JsxTagNameExpression,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { children } from "#scripts/check/source";

const JSX_MODULE_PATTERN = /\.tsx$/u;
/** An intrinsic element's tag starts lower case; a component's starts upper case. */
const INTRINSIC_TAG_PATTERN = /^[a-z]/u;

/**
 * The input types whose control the browser draws itself, each with the design-system field that
 * replaces it: a picker, spin buttons, a slider, a swatch or a clear button that no theme reaches.
 */
const NATIVE_INPUTS = HashMap.make(
  ["color", "a design-system colour field"],
  ["date", "DatePicker from @repo/design-system/components/ui/date"],
  [
    "datetime-local",
    "DateTimePicker from @repo/design-system/components/ui/date",
  ],
  ["month", "DatePicker from @repo/design-system/components/ui/date"],
  ["number", "NumberField from @repo/design-system/components/ui/number"],
  ["range", "Slider from @repo/design-system/components/ui/slider"],
  ["search", "SearchField from @repo/design-system/components/ui/search"],
  ["time", "TimeSelect from @repo/design-system/components/ui/time"],
  ["week", "DatePicker from @repo/design-system/components/ui/date"]
);

/** The name of an intrinsic element, such as `input`, or none for a component. */
function intrinsicName(tag: JsxTagNameExpression) {
  return isIdentifier(tag) && INTRINSIC_TAG_PATTERN.test(tag.text)
    ? Option.some(tag.text)
    : Option.none();
}

/** The literal text of an element's `type` attribute, when it is written as a string. */
function literalType(attributes: JsxAttributes) {
  return Arr.findFirst(attributes.properties, (property) =>
    isJsxAttribute(property) &&
    isIdentifier(property.name) &&
    property.name.text === "type" &&
    property.initializer !== undefined &&
    isStringLiteral(property.initializer)
      ? Option.some(property.initializer.text)
      : Option.none()
  );
}

/** The tag and attributes of a JSX element that opens one, or none for any other node. */
function opening(node: Node) {
  if (isJsxSelfClosingElement(node)) {
    return Option.some({ attributes: node.attributes, tag: node.tagName });
  }
  if (isJsxElement(node)) {
    return Option.some({
      attributes: node.openingElement.attributes,
      tag: node.openingElement.tagName,
    });
  }
  return Option.none();
}

/** The violation of one element: a native select, or an input whose type the browser draws. */
function elementViolation(file: string, node: Node) {
  return Option.flatMap(opening(node), ({ attributes, tag }) =>
    Option.flatMap(intrinsicName(tag), (name) => {
      if (name === "select") {
        return Option.some(
          `${file}: use Select from @repo/design-system/components/ui/select instead of a native <select>, which the browser draws itself.`
        );
      }
      if (name !== "input") {
        return Option.none();
      }
      return Option.flatMap(literalType(attributes), (type) =>
        Option.map(
          HashMap.get(NATIVE_INPUTS, type),
          (field) =>
            `${file}: use ${field} instead of <input type="${type}">, whose control the browser draws itself.`
        )
      );
    })
  );
}

/**
 * Reports every native control that the browser draws instead of the design system: a `<select>`,
 * and an `<input>` whose type brings a picker, spin buttons, a slider, a swatch or a clear button.
 * Each violation names the design-system field that replaces it. A text, file or hidden input stays.
 */
export function inspectNativeControls(file: string, sourceFile: SourceFile) {
  if (!JSX_MODULE_PATTERN.test(file)) {
    return [];
  }
  const visit = (node: Node): string[] =>
    Arr.appendAll(
      Option.toArray(elementViolation(file, node)),
      Arr.flatMap(children(node), visit)
    );
  return visit(sourceFile);
}
