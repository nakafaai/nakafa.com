const MATH_DELIMITERS = [
  ["$$", "$$"],
  ["\\[", "\\]"],
  ["\\(", "\\)"],
] as const;
const SPACE = /\s/;
const WORD = /[\p{L}\p{N}]/u;

/** A span whose source has no escapes, so only its closer ends it. */
interface OpenSpan {
  readonly closer: string;
  readonly start: number;
}

/** A link whose label or destination has not closed yet. */
interface OpenLink {
  /** An angle-bracket destination, which parentheses do not close. */
  angle: boolean;
  /** Open brackets in the label, then open parentheses in the destination. */
  depth: number;
  /** Where the destination starts, once the label has closed. */
  destination: number | undefined;
  readonly start: number;
}

/** Inline spans still open after the scanned text. */
export interface InlineState {
  code: OpenSpan | undefined;
  emphasis: { readonly marker: string; readonly start: number } | undefined;
  link: OpenLink | undefined;
  math: OpenSpan | undefined;
  /** A final character that may be the first half of a delimiter. */
  opener: number | undefined;
  strong: number | undefined;
}

/** Returns the state before any inline span opens. */
export function openInline(): InlineState {
  return {
    code: undefined,
    emphasis: undefined,
    link: undefined,
    math: undefined,
    opener: undefined,
    strong: undefined,
  };
}

/**
 * Ends the spans that never cross a paragraph or block boundary. An unclosed
 * marker there stays literal. Formulas may span blocks, so they stay open.
 */
export function breakInline(state: InlineState) {
  state.code = undefined;
  state.emphasis = undefined;
  state.link = undefined;
  state.strong = undefined;
}

/** Returns where the backtick run starting at `index` ends. */
function runEnd(line: string, index: number) {
  let end = index;
  while (line[end] === "`") {
    end += 1;
  }
  return end;
}

/**
 * Opens or closes single-marker emphasis by CommonMark flanking: an opener is
 * followed by a non-space and a closer follows one, and an underscore never
 * opens or closes inside a word.
 */
function stepEmphasis(
  line: string,
  index: number,
  position: number,
  final: boolean,
  state: InlineState
) {
  const marker = line.charAt(index);
  const before = line.charAt(index - 1);
  const after = line.charAt(index + 1);
  const intraword = marker === "_" && WORD.test(before);
  if (
    state.emphasis?.marker === marker &&
    before !== "" &&
    !SPACE.test(before) &&
    !(marker === "_" && WORD.test(after))
  ) {
    state.emphasis = undefined;
  } else if (final && !intraword) {
    // The next character decides whether this marker opens a span.
    state.opener = position;
  } else if (
    !(state.emphasis || intraword) &&
    after !== "" &&
    !SPACE.test(after)
  ) {
    state.emphasis = { marker, start: position };
  }
  return index + 1;
}

/**
 * Closes a link label. The destination must follow at once; a final `]` may
 * still get one, and anything else leaves plain brackets.
 */
function closeLabel(
  line: string,
  index: number,
  position: number,
  final: boolean,
  link: OpenLink,
  state: InlineState
) {
  link.depth -= 1;
  if (link.depth > 0 || final) {
    return index + 1;
  }
  if (line.charAt(index + 1) !== "(") {
    state.link = undefined;
    return index + 1;
  }
  link.depth = 1;
  link.destination = position + 2;
  return index + 2;
}

/** Tracks a destination until its balanced closing parenthesis arrives. */
function stepDestination(
  line: string,
  index: number,
  position: number,
  link: OpenLink,
  state: InlineState
) {
  const character = line.charAt(index);
  if (link.angle) {
    link.angle = character !== ">";
    return index + 1;
  }
  if (character === "\\") {
    return index + 2;
  }
  if (character === "<" && position === link.destination) {
    link.angle = true;
  } else if (character === "(") {
    link.depth += 1;
  } else if (character === ")") {
    link.depth -= 1;
    if (link.depth === 0) {
      state.link = undefined;
    }
  }
  return index + 1;
}

/** Advances through prose, opening spans and math delimiters. */
function stepProse(
  line: string,
  index: number,
  position: number,
  final: boolean,
  state: InlineState
) {
  const character = line.charAt(index);
  if (character === "`") {
    const end = runEnd(line, index);
    state.code = { closer: line.slice(index, end), start: position };
    return end;
  }
  if (line.startsWith("**", index)) {
    state.strong = state.strong === undefined ? position : undefined;
    return index + 2;
  }
  const delimiter = MATH_DELIMITERS.find(([open]) =>
    line.startsWith(open, index)
  );
  if (delimiter) {
    state.math = { closer: delimiter[1], start: position };
    return index + delimiter[0].length;
  }
  if (character === "*" || character === "_") {
    return stepEmphasis(line, index, position, final, state);
  }
  if (character === "[") {
    if (state.link) {
      state.link.depth += 1;
    } else {
      state.link = {
        angle: false,
        depth: 1,
        destination: undefined,
        start: position,
      };
    }
    return index + 1;
  }
  if (character === "]" && state.link) {
    return closeLabel(line, index, position, final, state.link, state);
  }
  if (final && (character === "$" || character === "\\")) {
    state.opener = position;
  }
  return index + (character === "\\" ? 2 : 1);
}

/** Advances one step inside an open span, or through prose. */
function stepInline(
  line: string,
  index: number,
  position: number,
  final: boolean,
  state: InlineState
) {
  const { code, link, math } = state;
  if (link?.destination !== undefined) {
    return stepDestination(line, index, position, link, state);
  }
  if (math) {
    // Math source has no escapes: the first closer ends the span.
    if (!line.startsWith(math.closer, index)) {
      return index + 1;
    }
    state.math = undefined;
    return index + math.closer.length;
  }
  if (code) {
    // Only a backtick run of the opening length closes a code span.
    if (line[index] !== "`") {
      return index + 1;
    }
    const end = runEnd(line, index);
    if (end - index === code.closer.length) {
      state.code = undefined;
    }
    return end;
  }
  return stepProse(line, index, position, final, state);
}

/**
 * Records the inline spans one line leaves open. `length` is the length of the
 * whole markdown, so the final character can be told apart.
 */
export function scanInline(
  line: string,
  lineStart: number,
  length: number,
  state: InlineState
) {
  let index = 0;
  while (index < line.length) {
    const position = lineStart + index;
    index = stepInline(line, index, position, position === length - 1, state);
  }
}
