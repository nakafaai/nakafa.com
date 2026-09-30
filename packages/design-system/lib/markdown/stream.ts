const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})[^`]*$/;
/** Fences whose renderer needs the complete source. */
const COMPLETE_SOURCE_FENCE =
  /^ {0,3}(?:`{3,}|~{3,})\s*(?:math|mermaid)(?:\s|$)/i;
/** A final line holding only a block marker that content has not followed. */
const PARTIAL_BLOCK =
  /^ {0,3}(?:`{1,2}|~{1,2}|#{1,6}|-{1,2}|[*+>]|\d{1,9}[.)]?)$/;
/** A line that starts a new block, which inline spans never cross. */
const BLOCK_START = /^ {0,3}(?:[-*+]\s|\d{1,9}[.)]\s|#{1,6}\s|>|\|)/;
const TABLE_ROW = /^ {0,3}\|/;
const TABLE_DELIMITER = /^ {0,3}\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const PARTIAL_TABLE_DELIMITER = /^ {0,3}\|?[\s:|-]*$/;
const MATH_DELIMITERS = [
  ["$$", "$$"],
  ["\\[", "\\]"],
  ["\\(", "\\)"],
] as const;
/** Final characters that may be the first half of a delimiter. */
const DELIMITER_STARTS = new Set(["$", "*", "\\"]);

/** A span whose source has no escapes, so only its closer ends it. */
interface OpenSpan {
  readonly closer: string;
  readonly start: number;
}

interface TailState {
  bold: number | undefined;
  code: OpenSpan | undefined;
  fence: { marker: string; start: number; withheld: boolean } | undefined;
  link: number | undefined;
  math: OpenSpan | undefined;
  opener: number | undefined;
  table: { confirmed: boolean; header: number } | undefined;
}

/** Returns whether a line consists only of `marker` characters. */
function isMarkerLine(line: string, marker: string) {
  const trimmed = line.trim();
  return (
    trimmed.length > 0 &&
    trimmed.split("").every((character) => character === marker[0])
  );
}

/** Opens a code span that the matching backtick run closes. */
function stepCode(
  line: string,
  index: number,
  lineStart: number,
  state: TailState
) {
  let end = index;
  while (line[end] === "`") {
    end += 1;
  }
  state.code = { closer: line.slice(index, end), start: lineStart + index };
  return end;
}

/**
 * Skips one link, recording it while its text or destination is unclosed, so
 * raw brackets never show before the link forms.
 */
function stepLink(
  line: string,
  index: number,
  lineStart: number,
  state: TailState
) {
  const text = line.indexOf("]", index + 1);
  const next = text === -1 ? undefined : line[text + 1];
  if (next !== undefined && next !== "(") {
    // Plain brackets, not a link.
    return index + 1;
  }
  const url = next === "(" ? line.indexOf(")", text + 2) : -1;
  if (url === -1) {
    // The text or destination is still open, or "(" may still follow.
    state.link ??= lineStart + index;
    return index + 1;
  }
  return url + 1;
}

/**
 * Tracks a table until a later line ends it. A header renders as a paragraph
 * until its delimiter row completes, and every streamed row can widen a column,
 * so a table appears once it is complete.
 */
function scanTable(
  line: string,
  lineStart: number,
  last: boolean,
  state: TailState
) {
  const { table } = state;
  if (last && !line.trim()) {
    // A newline after a row may still be followed by the next row.
    return;
  }
  if (table && !table.confirmed) {
    if (last && PARTIAL_TABLE_DELIMITER.test(line)) {
      return;
    }
    state.table =
      TABLE_DELIMITER.test(line) && !last
        ? { confirmed: true, header: table.header }
        : undefined;
    return;
  }
  if (!TABLE_ROW.test(line)) {
    state.table = undefined;
    return;
  }
  state.table ??= { confirmed: false, header: lineStart };
}

/** Advances through prose, tracking inline spans and math delimiters. */
function stepProse(
  line: string,
  index: number,
  lineStart: number,
  length: number,
  state: TailState
) {
  if (line[index] === "`") {
    return stepCode(line, index, lineStart, state);
  }
  if (line.startsWith("**", index)) {
    state.bold = state.bold === undefined ? lineStart + index : undefined;
    return index + 2;
  }
  const delimiter = MATH_DELIMITERS.find(([open]) =>
    line.startsWith(open, index)
  );
  if (delimiter) {
    state.math = { closer: delimiter[1], start: lineStart + index };
    return index + delimiter[0].length;
  }
  if (line[index] === "[") {
    return stepLink(line, index, lineStart, state);
  }
  const character = line.charAt(index);
  if (lineStart + index === length - 1 && DELIMITER_STARTS.has(character)) {
    state.opener = lineStart + index;
  }
  return index + (character === "\\" ? 2 : 1);
}

/** Records fence, table, formula, and inline span state after one line. */
function scanLine(
  line: string,
  lineStart: number,
  length: number,
  state: TailState
) {
  if (state.fence) {
    const { marker } = state.fence;
    if (isMarkerLine(line, marker) && line.trim().length >= marker.length) {
      state.fence = undefined;
    }
    return;
  }
  const marker = state.math ? undefined : FENCE_OPEN.exec(line)?.[1];
  if (marker) {
    const withheld = COMPLETE_SOURCE_FENCE.test(line);
    state.fence = { marker, start: lineStart, withheld };
    return;
  }
  if (!state.math) {
    scanTable(line, lineStart, lineStart + line.length === length, state);
    if (!line.trim() || BLOCK_START.test(line)) {
      // Bold and code spans may cross a soft line break but never a paragraph
      // or block boundary; an unclosed marker there stays literal.
      state.bold = undefined;
      state.code = undefined;
    }
  }
  // Links stay within their line.
  state.link = undefined;
  let index = 0;
  while (index < line.length) {
    const span = state.math ?? state.code;
    if (span === undefined) {
      index = stepProse(line, index, lineStart, length, state);
    } else if (line.startsWith(span.closer, index)) {
      // Math and code source have no escapes: the first closer ends the span.
      if (state.math) {
        state.math = undefined;
      } else {
        state.code = undefined;
      }
      index += span.closer.length;
    } else {
      index += 1;
    }
  }
}

/** Returns where an unfinished block or fence marker starts on the final line. */
function partialMarker(markdown: string, state: TailState) {
  const lineStart = markdown.lastIndexOf("\n") + 1;
  const line = markdown.slice(lineStart);
  if (state.fence) {
    // The marker line itself, or a closing marker still being typed.
    return state.fence.start === lineStart ||
      isMarkerLine(line, state.fence.marker)
      ? lineStart
      : undefined;
  }
  return PARTIAL_BLOCK.test(line) ? lineStart : undefined;
}

/**
 * Drops the tail of streamed markdown that would render differently once more
 * text arrives: a formula or diagram without its closing delimiter, since
 * KaTeX and Mermaid need complete source; an unclosed bold or code span in the
 * current paragraph; an unclosed link on the final line; a table that has not
 * ended; and a block marker, fence marker, or delimiter still being typed.
 * Code fences still render as they grow, and complete markdown returns
 * unchanged.
 */
export function trimIncompleteTail(markdown: string) {
  const state: TailState = {
    bold: undefined,
    code: undefined,
    fence: undefined,
    link: undefined,
    math: undefined,
    opener: undefined,
    table: undefined,
  };
  let lineStart = 0;
  for (const line of markdown.split("\n")) {
    scanLine(line, lineStart, markdown.length, state);
    lineStart += line.length + 1;
  }
  const cuts = [
    state.fence?.withheld ? state.fence.start : undefined,
    state.math?.start,
    state.code?.start,
    state.bold,
    state.link,
    state.opener,
    state.table?.header,
    partialMarker(markdown, state),
  ].filter((cut) => cut !== undefined);
  return cuts.length === 0 ? markdown : markdown.slice(0, Math.min(...cuts));
}
