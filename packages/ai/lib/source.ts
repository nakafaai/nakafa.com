import type { ModelMessage, UserModelMessage } from "ai";
import { ParseResultType, parseDomain } from "parse-domain";

const whitespacePattern = /\s+/;
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

  return text.split(whitespacePattern).flatMap((token) => {
    const reference = parseSourceReference(token);

    if (!reference) {
      return [];
    }

    if (seen.has(reference.href)) {
      return [];
    }

    seen.add(reference.href);
    return [reference];
  });
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
 * Reads the latest user-authored text from AI SDK model messages.
 */
function getLatestUserText(messages: ModelMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role !== "user") {
      continue;
    }

    return getUserMessageText(message);
  }

  return;
}

/**
 * Converts AI SDK user message text parts into one searchable text buffer.
 */
function getUserMessageText(message: UserModelMessage) {
  if (typeof message.content === "string") {
    return message.content;
  }

  let text = "";

  for (const part of message.content) {
    if (part.type !== "text") {
      continue;
    }

    text = `${text} ${part.text}`;
  }

  return text;
}

/**
 * Parses one whitespace-delimited token into an external source reference.
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
