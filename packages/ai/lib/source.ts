import { getLatestUserText } from "@repo/ai/lib/user";
import type { ModelMessage } from "ai";
import { ParseResultType, parseDomain } from "parse-domain";

const whitespacePattern = /\s+/;
const sourceSeparators = new Set([",", ";"]);
const boundaryPunctuation = new Set([
  '"',
  "'",
  "(",
  ")",
  ",",
  ".",
  "!",
  ":",
  ";",
  "?",
  "<",
  ">",
  "[",
  "]",
  "`",
  "{",
  "}",
]);

/**
 * Source reference extracted from user-written text.
 */
export type SourceReference = ReturnType<typeof createSourceReference>;

/**
 * Extracts every unique external source reference from plain user text.
 */
export function getSourceReferences(text: string) {
  const seen = new Set<string>();

  return text.split(whitespacePattern).flatMap((token) =>
    splitSourceToken(token).flatMap((segment) => {
      const reference = parseSourceReference(segment);

      if (!reference) {
        return [];
      }

      if (seen.has(reference.href)) {
        return [];
      }

      seen.add(reference.href);
      return [reference];
    })
  );
}

/**
 * Extracts external source references from the latest AI SDK user message.
 */
export function getSourceReferencesFromMessages(messages: ModelMessage[]) {
  const latestText = getLatestUserText(messages);

  if (!latestText) {
    return [];
  }

  return getSourceReferences(latestText);
}

/**
 * Parses one candidate segment into an external source reference.
 */
function parseSourceReference(token: string) {
  const text = isolateSourceText(token);

  if (!text) {
    return;
  }

  if (text.includes("@")) {
    return;
  }

  const url = toWebUrl(text);

  if (!url) {
    return;
  }

  const result = parseDomain(url.hostname);

  if (result.type !== ParseResultType.Listed) {
    return;
  }

  if (!result.domain) {
    return;
  }

  return createSourceReference(text, url);
}

/**
 * Splits user text like `a.com,b.com` without breaking commas inside one URL.
 */
function splitSourceToken(token: string): string[] {
  const separatorIndex = findSourceSeparator(token);

  if (separatorIndex === undefined) {
    return [token];
  }

  return [
    token.slice(0, separatorIndex),
    ...splitSourceToken(token.slice(separatorIndex + 1)),
  ];
}

/**
 * Finds the next separator only when another source starts after it.
 */
function findSourceSeparator(token: string) {
  for (let index = 0; index < token.length; index += 1) {
    if (!sourceSeparators.has(token[index])) {
      continue;
    }

    if (startsWithSourceReference(token.slice(index + 1))) {
      return index;
    }
  }

  return;
}

/**
 * Checks whether the next separator-delimited segment is a web source.
 */
function startsWithSourceReference(text: string) {
  return Boolean(parseSourceReference(getLeadingSegment(text)));
}

/**
 * Reads the next source-sized segment after a comma or semicolon split.
 */
function getLeadingSegment(text: string) {
  for (let index = 0; index < text.length; index += 1) {
    if (sourceSeparators.has(text[index])) {
      return text.slice(0, index);
    }
  }

  return text;
}

/**
 * Keeps URL-looking text when it is wrapped by Markdown or punctuation.
 */
function isolateSourceText(token: string) {
  const trimmed = trimBoundaryPunctuation(token);
  const lowerText = trimmed.toLowerCase();
  const httpsIndex = lowerText.indexOf("https://");

  if (httpsIndex > 0) {
    return trimBoundaryPunctuation(trimmed.slice(httpsIndex));
  }

  const httpIndex = lowerText.indexOf("http://");

  if (httpIndex > 0) {
    return trimBoundaryPunctuation(trimmed.slice(httpIndex));
  }

  return trimmed;
}

/**
 * Converts full and bare web references into a URL object.
 */
function toWebUrl(text: string) {
  const lowerText = text.toLowerCase();
  const candidate =
    lowerText.startsWith("http://") || lowerText.startsWith("https://")
      ? text
      : `https://${text}`;

  if (!URL.canParse(candidate)) {
    return;
  }

  const url = new URL(candidate);
  return url;
}

/**
 * Creates the normalized source reference object used across AI modules.
 */
function createSourceReference(text: string, url: URL) {
  return {
    href: url.toString(),
    hostname: url.hostname,
    text,
  };
}

/**
 * Removes punctuation that users commonly place around URLs or domains.
 */
function trimBoundaryPunctuation(token: string) {
  let start = 0;
  let end = token.length;

  while (start < end && boundaryPunctuation.has(token[start])) {
    start += 1;
  }

  while (end > start && boundaryPunctuation.has(token[end - 1])) {
    end -= 1;
  }

  return token.slice(start, end);
}
