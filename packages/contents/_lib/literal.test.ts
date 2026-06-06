import {
  extractObjectLiteralAfterDeclaration,
  parseObjectLiteral,
} from "@repo/contents/_lib/literal";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

const METADATA_DECLARATION_REGEX = /export const metadata\s*=/;

describe("content literal parsing", describeContentLiteralParsing);

/** Covers the safe parser used for authored MDX metadata literals. */
function describeContentLiteralParsing() {
  it("parses JSON5 object literals as data", parseJson5ObjectLiteral);
  it("rejects non-object literals", rejectNonObjectLiteral);
  it(
    "extracts object literals with braces inside strings",
    extractBracedStringLiteral
  );
  it(
    "returns Option.none for invalid object syntax",
    rejectInvalidObjectSyntax
  );
  it("skips escaped quotes while matching strings", extractEscapedQuoteString);
  it(
    "returns Option.none for unterminated strings",
    rejectUnterminatedStringLiteral
  );
  it(
    "returns Option.none when the declaration is absent",
    rejectMissingDeclaration
  );
  it(
    "returns Option.none when the declaration has no object",
    rejectMissingObject
  );
  it("returns Option.none when the object is not closed", rejectUnclosedObject);
  it("extracts nested object literals", extractNestedObjectLiteral);
}

/** Verifies JSON5 object-literal syntax is accepted as plain data. */
function parseJson5ObjectLiteral() {
  const result = parseObjectLiteral(`{
      title: "Valid",
      authors: [{ name: "Author" }],
      date: "01/01/2024",
    }`);

  expect(Option.getOrUndefined(result)).toStrictEqual({
    title: "Valid",
    authors: [{ name: "Author" }],
    date: "01/01/2024",
  });
}

/** Verifies array and primitive literals are rejected at the content boundary. */
function rejectNonObjectLiteral() {
  expect(Option.isNone(parseObjectLiteral("[]"))).toBe(true);
}

/** Verifies brace matching ignores braces that belong to quoted strings. */
function extractBracedStringLiteral() {
  const result = extractObjectLiteralAfterDeclaration(
    `export const metadata = { title: "A {nested} title" };\n\n# Body`,
    METADATA_DECLARATION_REGEX
  );

  expect(Option.getOrUndefined(result)).toBe('{ title: "A {nested} title" }');
}

/** Verifies malformed JSON5 object syntax is treated as a data miss. */
function rejectInvalidObjectSyntax() {
  expect(Option.isNone(parseObjectLiteral("{ title: "))).toBe(true);
}

/** Verifies escaped quotes do not terminate the string matcher early. */
function extractEscapedQuoteString() {
  const result = extractObjectLiteralAfterDeclaration(
    String.raw`export const metadata = { title: "A \"quoted\" {title}" };`,
    METADATA_DECLARATION_REGEX
  );

  expect(Option.getOrUndefined(result)).toBe(
    String.raw`{ title: "A \"quoted\" {title}" }`
  );
}

/** Verifies a malformed quoted string prevents partial literal extraction. */
function rejectUnterminatedStringLiteral() {
  const result = extractObjectLiteralAfterDeclaration(
    'export const metadata = { title: "Unclosed };\n\n# Body',
    METADATA_DECLARATION_REGEX
  );

  expect(Option.isNone(result)).toBe(true);
}

/** Verifies extraction requires the requested declaration before scanning. */
function rejectMissingDeclaration() {
  const result = extractObjectLiteralAfterDeclaration(
    "export const other = { title: 'Ignored' };",
    METADATA_DECLARATION_REGEX
  );

  expect(Option.isNone(result)).toBe(true);
}

/** Verifies extraction does not invent an object when no opening brace exists. */
function rejectMissingObject() {
  const result = extractObjectLiteralAfterDeclaration(
    "export const metadata = undefined;",
    METADATA_DECLARATION_REGEX
  );

  expect(Option.isNone(result)).toBe(true);
}

/** Verifies extraction requires the object braces to balance. */
function rejectUnclosedObject() {
  const result = extractObjectLiteralAfterDeclaration(
    "export const metadata = { title: 'Unclosed'",
    METADATA_DECLARATION_REGEX
  );

  expect(Option.isNone(result)).toBe(true);
}

/** Verifies nested object braces keep the scanner open until the outer close. */
function extractNestedObjectLiteral() {
  const result = extractObjectLiteralAfterDeclaration(
    "export const metadata = { title: 'Parent', nested: { title: 'Child' } };",
    METADATA_DECLARATION_REGEX
  );

  expect(Option.getOrUndefined(result)).toBe(
    "{ title: 'Parent', nested: { title: 'Child' } }"
  );
}
