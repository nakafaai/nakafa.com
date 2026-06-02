import { Effect, Either, Option } from "effect";
import JSON5 from "json5";

type LiteralObject = Record<string, unknown>;
const literalParseError = "invalid literal parse";

/**
 * Extracts an object literal after a known declaration without executing code.
 */
export function extractObjectLiteralAfterDeclaration(
  source: string,
  declarationRegex: RegExp
) {
  const declaration = Option.fromNullable(source.match(declarationRegex));

  if (Option.isNone(declaration)) {
    return Option.none();
  }

  const declarationEnd =
    source.search(declarationRegex) + declaration.value[0].length;
  const objectStart = source.indexOf("{", declarationEnd);

  if (objectStart === -1) {
    return Option.none();
  }

  let depth = 0;

  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index];

    if (char === '"' || char === "'" || char === "`") {
      const stringEnd = skipQuotedString(source, index);

      if (Option.isNone(stringEnd)) {
        return Option.none();
      }

      index = stringEnd.value;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char !== "}") {
      continue;
    }

    depth -= 1;

    if (depth === 0) {
      return Option.some(source.slice(objectStart, index + 1));
    }
  }

  return Option.none();
}

/**
 * Parses authored content literals as data instead of using `eval`/`Function`.
 * React Doctor flags code execution from strings as unsafe:
 * https://www.react.doctor/docs/getting-started/how-to-fix-issues
 */
export function parseObjectLiteral(source: string) {
  const parsed = parseJson5LiteralSafely(source);

  if (Option.isNone(parsed)) {
    return Option.none();
  }

  return isRecord(parsed.value) ? Option.some(parsed.value) : Option.none();
}

/** Parses one JSON5 literal and converts syntax failures into `Option.none()`. */
function parseJson5LiteralSafely(source: string) {
  const parsed = Effect.runSync(
    Effect.either(
      Effect.try({
        try: () => parseJson5Literal(source),
        catch: () => literalParseError,
      })
    )
  );

  if (Either.isLeft(parsed)) {
    return Option.none();
  }

  return Option.some(parsed.right);
}

/** Parses one JSON5 literal string into an unknown data value. */
function parseJson5Literal(source: string) {
  return JSON5.parse(source);
}

/** Returns whether a parsed literal is a plain object record. */
function isRecord(value: unknown): value is LiteralObject {
  const valueOption = Option.fromNullable(value);

  return (
    Option.isSome(valueOption) &&
    typeof valueOption.value === "object" &&
    !Array.isArray(valueOption.value)
  );
}

/**
 * Finds the closing quote for one string literal while skipping escapes.
 */
function skipQuotedString(source: string, startIndex: number) {
  const quote = source[startIndex];

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const char = source[index];

    if (char === "\\") {
      index += 1;
      continue;
    }

    if (char === quote) {
      return Option.some(index);
    }
  }

  return Option.none();
}
