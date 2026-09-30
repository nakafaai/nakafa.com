import {
  breakInline,
  type InlineState,
  openInline,
  scanInline,
} from "@repo/design-system/lib/markdown/inline";

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})[^`]*$/;
/** Fences whose renderer needs the complete source. */
const COMPLETE_SOURCE_FENCE =
  /^ {0,3}(?:`{3,}|~{3,})\s*(?:math|mermaid)(?:\s|$)/i;
/** A final line holding only a block marker that content has not followed. */
const PARTIAL_BLOCK =
  /^ {0,3}(?:`{1,2}|~{1,2}|#{1,6}|-{1,2}|[*+>]|\d{1,9}[.)]?)$/;
/** A line that starts a new block, which inline spans never cross. */
const BLOCK_START = /^ {0,3}(?:[-*+]\s|\d{1,9}[.)]\s|#{1,6}\s|>|\|)/;
/** A table row, with or without the optional leading pipe. */
const TABLE_ROW = /\|/;
const TABLE_DELIMITER = /^ {0,3}\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const PARTIAL_TABLE_DELIMITER = /^ {0,3}\|?[\s:|-]*$/;

interface TailState extends InlineState {
  fence: { marker: string; start: number; withheld: boolean } | undefined;
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
    if (TABLE_DELIMITER.test(line) && !last) {
      state.table = { confirmed: true, header: table.header };
      return;
    }
    // Not a delimiter row, so this line may start a table itself.
    state.table = undefined;
  }
  if (!TABLE_ROW.test(line)) {
    state.table = undefined;
    return;
  }
  state.table ??= { confirmed: false, header: lineStart };
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
      breakInline(state);
    }
  }
  scanInline(line, lineStart, length, state);
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
 * KaTeX and Mermaid need complete source; an unclosed emphasis, code span, or
 * link in the current paragraph; a table that has not ended; and a block
 * marker, fence marker, or delimiter still being typed. Code fences still
 * render as they grow, and complete markdown returns unchanged.
 */
export function trimIncompleteTail(markdown: string) {
  const state: TailState = {
    ...openInline(),
    fence: undefined,
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
    state.strong,
    state.emphasis?.start,
    state.link?.start,
    state.opener,
    state.table?.header,
    partialMarker(markdown, state),
  ].filter((cut) => cut !== undefined);
  return cuts.length === 0 ? markdown : markdown.slice(0, Math.min(...cuts));
}
