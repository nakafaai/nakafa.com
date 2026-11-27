import { Array as Arr, HashSet, Option, Result } from "effect";
import type { Node, SourceFile } from "tsrs/ast";
import {
  isIdentifier,
  isJsxAttribute,
  isNoSubstitutionTemplateLiteral,
  isPropertyAssignment,
  isStringLiteral,
  isTemplateExpression,
} from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import { attributeValue, opening } from "#scripts/check/jsx";
import { TEST_PATTERN } from "#scripts/check/kinds";
import { place } from "#scripts/check/places";

const CONTENTS_PREFIX = "packages/design-system/components/contents/";
const MATH_TAGS = HashSet.make("BlockMath", "InlineMath", "MathLines");
const EXEMPT_ATTRIBUTES = HashSet.make(
  "aria-label",
  "className",
  "href",
  "id",
  "key",
  "math"
);
const FACT_TAGS = HashSet.make("VisualFact", "VisualFactTabular");
const SLIDER_TAG = "VisualSlider";

/** LaTeX command prefix marking a string already formatted for KaTeX. */
const LATEX_COMMAND_PATTERN =
  /\\(?:Delta|Omega|alpha|beta|cdot|dfrac|frac|gamma|leftarrow|leftrightarrow|mathrm|mu|pi|rightarrow|text|times)\b/u;

/** Plain-text exponents, ASCII arrows, or ASCII unit powers that belong in KaTeX. */
const PLAIN_MATH_PATTERN =
  /(?:[A-Za-z0-9)\]]\^(?:\d+|[+-])|\b(?:10|2)\^(?:\s|$)|(?:^|\s)(?:->|<-|<->)(?:\s|$)|\b(?:cm|dm|mm|km)3\b|\b(?:m\/s|g\/cm|mol\/dm)[23]\b)/u;

/** Scientific units, percentages, degrees, or pH prefixes inside raw fact/slider strings. */
const PLAIN_READOUT_UNIT_PATTERN =
  /(?:%|°|\bpH\b|×|\b(?:mm|cm|km|mg|kg|mL|mol|dm|kPa|MPa|kJ|Hz|nm|eV|μm|µm|atm|bar|ppm|ppb|rad|rpm)\b|(?:\s|^)(?:m|g|s|h|J|N|W|V|A|K|L|Pa)$)/u;

const PLAIN_MATH_RULE =
  "plain-text exponent, arrow, or ASCII unit power belongs in <InlineMath math={...} /> instead of a raw string.";

const PLAIN_READOUT_RULE =
  "numeric or unit readout on VisualFact/VisualSlider belongs in <InlineMath math={...} /> using useQuantity() instead of a plain string.";

/** Returns the literal text segments of a string or template node, or none for other nodes. */
function literalText(node: Node): Option.Option<string> {
  if (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) {
    return Option.some(node.text);
  }
  if (isTemplateExpression(node)) {
    const parts = Arr.prepend(
      Arr.map(node.templateSpans, (span) => span.literal.text),
      node.head.text
    );
    return Option.some(Arr.join(parts, " "));
  }
  return Option.none();
}

/** Whether `node` already sits inside a KaTeX math expression or non-rendered attribute. */
function insideMathOrExemptContext(node: Node): boolean {
  let cursor = node.parent;
  while (cursor !== undefined) {
    if (
      Option.exists(opening(cursor), ({ tag }) => HashSet.has(MATH_TAGS, tag))
    ) {
      return true;
    }
    if (
      isJsxAttribute(cursor) &&
      isIdentifier(cursor.name) &&
      HashSet.has(EXEMPT_ATTRIBUTES, cursor.name.text)
    ) {
      return true;
    }
    if (
      isPropertyAssignment(cursor) &&
      isIdentifier(cursor.name) &&
      (cursor.name.text === "math" ||
        cursor.name.text === "tex" ||
        cursor.name.text.endsWith("Math"))
    ) {
      return true;
    }
    cursor = cursor.parent;
  }
  return false;
}

/** Returns the attribute name carrying a numeric/unit readout on `tag`, if any. */
function readoutAttribute(tag: string | undefined): string | undefined {
  if (tag !== undefined && HashSet.has(FACT_TAGS, tag)) {
    return "value";
  }
  if (tag === SLIDER_TAG) {
    return "readout";
  }
  return undefined;
}

/** Checks a `VisualFact`, `VisualFactTabular`, or `VisualSlider` element for raw unit/percent readouts. */
function readoutViolation(
  file: string,
  sourceFile: SourceFile,
  node: Node
): Option.Option<string> {
  return Option.flatMap(opening(node), ({ attributes, tag }) => {
    const prop = readoutAttribute(tag);
    if (prop === undefined) {
      return Option.none();
    }
    return Option.flatMap(attributeValue(attributes, prop), (valueNode) =>
      Option.flatMap(literalText(valueNode), (text) =>
        PLAIN_READOUT_UNIT_PATTERN.test(text)
          ? Option.some(
              `${place(file, sourceFile, valueNode)}: ${PLAIN_READOUT_RULE}`
            )
          : Option.none()
      )
    );
  });
}

/**
 * Reports plain-text math expressions, ASCII arrows, ASCII unit exponents, and
 * raw unit/percentage template strings inside `VisualFact`/`VisualSlider`
 * readouts under `packages/design-system/components/contents/`.
 */
export function inspectMathSource(file: string, sourceFile: SourceFile) {
  if (!file.startsWith(CONTENTS_PREFIX) || TEST_PATTERN.test(file)) {
    return [];
  }
  const nodes = nodesBelow(sourceFile);
  const plainMath = Arr.filterMap(nodes, (node) => {
    if (insideMathOrExemptContext(node)) {
      return Result.failVoid;
    }
    return Option.match(literalText(node), {
      onNone: () => Result.failVoid,
      onSome: (text) =>
        !LATEX_COMMAND_PATTERN.test(text) && PLAIN_MATH_PATTERN.test(text)
          ? Result.succeed(
              `${place(file, sourceFile, node)}: ${PLAIN_MATH_RULE}`
            )
          : Result.failVoid,
    });
  });
  const plainReadouts = Arr.filterMap(nodes, (node) =>
    Option.match(readoutViolation(file, sourceFile, node), {
      onNone: () => Result.failVoid,
      onSome: Result.succeed,
    })
  );
  return Arr.appendAll(plainMath, plainReadouts);
}
