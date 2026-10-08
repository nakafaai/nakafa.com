import {
  breakInline,
  InlineStateSchema,
  openInline,
  scanInline,
} from "@repo/design-system/lib/markdown/inline";
import { Schema } from "effect";

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})[^`]*$/;
/** Fences whose renderer needs the complete source. */
const COMPLETE_SOURCE_FENCE =
  /^ {0,3}(?:`{3,}|~{3,})\s*(?:math|mermaid)(?:\s|$)/i;
/** A final line holding only a block marker that content has not followed. */
const PARTIAL_BLOCK =
  /^ {0,3}(?:`{1,2}|~{1,2}|#{1,6}|-{1,2}|[*+>]|\d{1,9}[.)]?)$/;
/** A line that starts a new block, which inline spans never cross. */
const BLOCK_START = /^ {0,3}(?:[-*+]\s|\d{1,9}[.)]\s|#{1,6}\s|>|\|)/;
/** An escaped character, which never separates table cells. */
const ESCAPED = /\\./g;
/** A fence line with at most three spaces of indentation. */
const FENCE_MARKER = /^ {0,3}(`+|~+)[ \t]*$/;
const TABLE_DELIMITER = /^ {0,3}\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const PARTIAL_TABLE_DELIMITER = /^ {0,3}\|?[\s:|-]*$/;

const TailStateSchema = Schema.Struct({
  ...InlineStateSchema.fields,
  fence: Schema.UndefinedOr(
    Schema.Struct({
      marker: Schema.String,
      start: Schema.Finite,
      withheld: Schema.Boolean,
    })
  ),
  table: Schema.UndefinedOr(
    Schema.Struct({
      confirmed: Schema.Boolean,
      header: Schema.Finite,
    })
  ),
});
type TailState = typeof TailStateSchema.Type;

/**
 * Returns the run of a line holding only fence characters of `marker`'s kind,
 * indented at most three spaces as CommonMark requires of a closing fence.
 */
function fenceRun(line: string, marker: string) {
  const run = FENCE_MARKER.exec(line)?.[1];
  return run?.[0] === marker[0] ? run : undefined;
}

/** A table row has an unescaped pipe, with or without the leading pipe. */
function isTableRow(line: string) {
  return line.replace(ESCAPED, "").includes("|");
}

/**
 * Tracks a table until a later line ends it. A header renders as a paragraph
 * until its delimiter row completes, and every streamed row can widen a column,
 * so a table appears once it is complete.
 */
function nextTable(
  line: string,
  lineStart: number,
  last: boolean,
  table: TailState["table"]
): TailState["table"] {
  if (last && !line.trim()) {
    // A newline after a row may still be followed by the next row.
    return table;
  }
  if (table && !table.confirmed) {
    if (last && PARTIAL_TABLE_DELIMITER.test(line)) {
      return table;
    }
    if (TABLE_DELIMITER.test(line) && !last) {
      return { confirmed: true, header: table.header };
    }
    // Not a delimiter row, so this line may start a table itself.
    return isTableRow(line)
      ? { confirmed: false, header: lineStart }
      : undefined;
  }
  if (!isTableRow(line)) {
    return undefined;
  }
  return table ?? { confirmed: false, header: lineStart };
}

/** Records fence, table, formula, and inline span state after one line. */
function scanLine(
  line: string,
  lineStart: number,
  length: number,
  state: TailState
): TailState {
  if (state.fence) {
    const { marker } = state.fence;
    if ((fenceRun(line, marker)?.length ?? 0) >= marker.length) {
      return { ...state, fence: undefined };
    }
    return state;
  }
  const marker = state.math ? undefined : FENCE_OPEN.exec(line)?.[1];
  if (marker) {
    const withheld = COMPLETE_SOURCE_FENCE.test(line);
    return { ...state, fence: { marker, start: lineStart, withheld } };
  }
  if (state.math) {
    return {
      ...scanInline(line, lineStart, length, state),
      fence: undefined,
      table: state.table,
    };
  }
  const table = nextTable(
    line,
    lineStart,
    lineStart + line.length === length,
    state.table
  );
  const inline =
    !line.trim() || BLOCK_START.test(line) ? breakInline(state) : state;
  return {
    ...scanInline(line, lineStart, length, inline),
    fence: undefined,
    table,
  };
}

/** Returns where an unfinished block or fence marker starts on the final line. */
function partialMarker(markdown: string, state: TailState) {
  const lineStart = markdown.lastIndexOf("\n") + 1;
  const line = markdown.slice(lineStart);
  if (state.fence) {
    // The marker line itself, or a closing marker still being typed.
    return state.fence.start === lineStart || fenceRun(line, state.fence.marker)
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
  let state: TailState = {
    ...openInline(),
    fence: undefined,
    table: undefined,
  };
  let lineStart = 0;
  for (const line of markdown.split("\n")) {
    state = scanLine(line, lineStart, markdown.length, state);
    lineStart += line.length + 1;
  }
  const cuts = [
    state.fence?.withheld ? state.fence.start : undefined,
    state.math?.start,
    state.code?.start,
    state.strong?.start,
    state.emphasis?.start,
    state.link?.start,
    state.opener,
    state.table?.header,
    partialMarker(markdown, state),
  ].filter((cut) => cut !== undefined);
  return cuts.length === 0 ? markdown : markdown.slice(0, Math.min(...cuts));
}
