import { Effect, Either } from "effect";
import JSON5 from "json5";

type LiteralObject = Record<string, unknown>;

/**
 * Extracts an object literal after a known declaration without executing code.
 */
export function extractObjectLiteralAfterDeclaration(
  source: string,
  declarationRegex: RegExp
) {
  const declaration = source.match(declarationRegex);

  if (!declaration || declaration.index === undefined) {
    return null;
  }

  const declarationEnd = declaration.index + declaration[0].length;
  const objectStart = source.indexOf("{", declarationEnd);

  if (objectStart === -1) {
    return null;
  }

  let depth = 0;

  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index];

    if (char === '"' || char === "'" || char === "`") {
      const stringEnd = skipQuotedString(source, index);

      if (stringEnd === null) {
        return null;
      }

      index = stringEnd;
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
      return source.slice(objectStart, index + 1);
    }
  }

  return null;
}

/**
 * Parses authored content literals as data instead of using `eval`/`Function`.
 * React Doctor flags code execution from strings as unsafe:
 * https://www.react.doctor/docs/getting-started/how-to-fix-issues
 */
export function parseObjectLiteral(source: string) {
  const parsed = parseJson5LiteralSafely(source);

  if (parsed === null) {
    return null;
  }

  return isRecord(parsed) ? parsed : null;
}

/** Parses one JSON5 literal and converts syntax failures into `null`. */
function parseJson5LiteralSafely(source: string) {
  const parsed = Effect.runSync(
    Effect.either(
      Effect.try({
        try: parseJson5Literal.bind(null, source),
        catch: ignoreLiteralParseError,
      })
    )
  );

  if (Either.isLeft(parsed)) {
    return null;
  }

  return parsed.right;
}

/** Parses one JSON5 literal string into an unknown data value. */
function parseJson5Literal(source: string) {
  return JSON5.parse(source);
}

/** Keeps parse failures as data misses instead of throwing during content scans. */
function ignoreLiteralParseError() {
  return null;
}

/** Returns whether a parsed literal is a plain object record. */
function isRecord(value: unknown): value is LiteralObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
      return index;
    }
  }

  return null;
}
