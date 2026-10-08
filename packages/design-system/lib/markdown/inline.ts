import { Schema } from "effect";

const MATH_DELIMITERS = [
  ["$$", "$$"],
  ["\\[", "\\]"],
  ["\\(", "\\)"],
] as const;
const SPACE = /\s/;
const WORD = /[\p{L}\p{N}]/u;

/** A span whose source has no escapes, so only its closer ends it. */
const OpenSpanSchema = Schema.Struct({
  closer: Schema.String,
  start: Schema.Finite,
});

/** A link whose label or destination has not closed yet. */
const OpenLinkSchema = Schema.Struct({
  /** An angle-bracket destination, which parentheses do not close. */
  angle: Schema.Boolean,
  /** Open brackets in the label, then open parentheses in the destination. */
  depth: Schema.Finite,
  /** Where the destination starts, once the label has closed. */
  destination: Schema.UndefinedOr(Schema.Finite),
  start: Schema.Finite,
});
type OpenLink = typeof OpenLinkSchema.Type;

const MarkerSpanSchema = Schema.Struct({
  marker: Schema.String,
  start: Schema.Finite,
});

/** Inline spans still open after the scanned text. */
export const InlineStateSchema = Schema.Struct({
  code: Schema.UndefinedOr(OpenSpanSchema),
  emphasis: Schema.UndefinedOr(MarkerSpanSchema),
  link: Schema.UndefinedOr(OpenLinkSchema),
  math: Schema.UndefinedOr(OpenSpanSchema),
  /** A final character that may be the first half of a delimiter. */
  opener: Schema.UndefinedOr(Schema.Finite),
  strong: Schema.UndefinedOr(MarkerSpanSchema),
});
export type InlineState = typeof InlineStateSchema.Type;

/** Where scanning resumes after one step, and the spans open at that point. */
const StepSchema = Schema.Struct({
  index: Schema.Finite,
  state: InlineStateSchema,
});
type Step = typeof StepSchema.Type;

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
export function breakInline(state: InlineState): InlineState {
  return {
    ...state,
    code: undefined,
    emphasis: undefined,
    link: undefined,
    strong: undefined,
  };
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
): Step {
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
    return { index: index + 1, state: { ...state, emphasis: undefined } };
  }
  if (final && !intraword) {
    // The next character decides whether this marker opens a span.
    return { index: index + 1, state: { ...state, opener: position } };
  }
  if (!(state.emphasis || intraword) && after !== "" && !SPACE.test(after)) {
    return {
      index: index + 1,
      state: { ...state, emphasis: { marker, start: position } },
    };
  }
  return { index: index + 1, state };
}

/**
 * Opens or closes `__` strong emphasis by the same flanking rules as a single
 * underscore. A final `__` may still open a span, so it is withheld.
 */
function stepStrongUnderscore(
  line: string,
  index: number,
  position: number,
  length: number,
  state: InlineState
): Step {
  const before = line.charAt(index - 1);
  const after = line.charAt(index + 2);
  if (state.strong?.marker === "__") {
    if (before !== "" && !SPACE.test(before) && !WORD.test(after)) {
      return { index: index + 2, state: { ...state, strong: undefined } };
    }
  } else if (!(state.strong || WORD.test(before))) {
    if (position + 1 === length - 1) {
      return { index: index + 2, state: { ...state, opener: position } };
    }
    if (after !== "" && !SPACE.test(after)) {
      return {
        index: index + 2,
        state: { ...state, strong: { marker: "__", start: position } },
      };
    }
  }
  return { index: index + 2, state };
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
): Step {
  const depth = link.depth - 1;
  if (depth > 0 || final) {
    return { index: index + 1, state: { ...state, link: { ...link, depth } } };
  }
  if (line.charAt(index + 1) !== "(") {
    return { index: index + 1, state: { ...state, link: undefined } };
  }
  return {
    index: index + 2,
    state: {
      ...state,
      link: { ...link, depth: 1, destination: position + 2 },
    },
  };
}

/** Tracks a destination until its balanced closing parenthesis arrives. */
function stepDestination(
  line: string,
  index: number,
  position: number,
  link: OpenLink,
  state: InlineState
): Step {
  const character = line.charAt(index);
  if (link.angle) {
    return {
      index: index + 1,
      state: { ...state, link: { ...link, angle: character !== ">" } },
    };
  }
  if (character === "\\") {
    return { index: index + 2, state };
  }
  if (character === "<" && position === link.destination) {
    return {
      index: index + 1,
      state: { ...state, link: { ...link, angle: true } },
    };
  }
  if (character === "(") {
    return {
      index: index + 1,
      state: { ...state, link: { ...link, depth: link.depth + 1 } },
    };
  }
  if (character === ")") {
    const depth = link.depth - 1;
    return {
      index: index + 1,
      state: { ...state, link: depth === 0 ? undefined : { ...link, depth } },
    };
  }
  return { index: index + 1, state };
}

/** Advances through prose, opening spans and math delimiters. */
function stepProse(
  line: string,
  index: number,
  position: number,
  length: number,
  state: InlineState
): Step {
  const character = line.charAt(index);
  const final = position === length - 1;
  if (character === "`") {
    const end = runEnd(line, index);
    return {
      index: end,
      state: {
        ...state,
        code: { closer: line.slice(index, end), start: position },
      },
    };
  }
  if (line.startsWith("**", index)) {
    // Asterisk strong emphasis toggles; an underscore span keeps it literal.
    const strong =
      state.strong?.marker === "**"
        ? undefined
        : (state.strong ?? { marker: "**", start: position });
    return { index: index + 2, state: { ...state, strong } };
  }
  if (line.startsWith("__", index)) {
    return stepStrongUnderscore(line, index, position, length, state);
  }
  const delimiter = MATH_DELIMITERS.find(([open]) =>
    line.startsWith(open, index)
  );
  if (delimiter) {
    return {
      index: index + delimiter[0].length,
      state: { ...state, math: { closer: delimiter[1], start: position } },
    };
  }
  if (character === "*" || character === "_") {
    return stepEmphasis(line, index, position, final, state);
  }
  if (character === "[") {
    if (state.link) {
      return {
        index: index + 1,
        state: {
          ...state,
          link: { ...state.link, depth: state.link.depth + 1 },
        },
      };
    }
    return {
      index: index + 1,
      state: {
        ...state,
        link: {
          angle: false,
          depth: 1,
          destination: undefined,
          start: position,
        },
      },
    };
  }
  if (character === "]" && state.link) {
    return closeLabel(line, index, position, final, state.link, state);
  }
  const width = character === "\\" ? 2 : 1;
  if (final && (character === "$" || character === "\\")) {
    return { index: index + width, state: { ...state, opener: position } };
  }
  return { index: index + width, state };
}

/** Advances one step inside an open span, or through prose. */
function stepInline(
  line: string,
  index: number,
  position: number,
  length: number,
  state: InlineState
): Step {
  const { code, link, math } = state;
  if (link?.destination !== undefined) {
    return stepDestination(line, index, position, link, state);
  }
  if (math) {
    // Math source has no escapes: the first closer ends the span.
    if (!line.startsWith(math.closer, index)) {
      return { index: index + 1, state };
    }
    return {
      index: index + math.closer.length,
      state: { ...state, math: undefined },
    };
  }
  if (code) {
    // Only a backtick run of the opening length closes a code span.
    if (line[index] !== "`") {
      return { index: index + 1, state };
    }
    const end = runEnd(line, index);
    const closed = end - index === code.closer.length;
    return {
      index: end,
      state: closed ? { ...state, code: undefined } : state,
    };
  }
  return stepProse(line, index, position, length, state);
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
): InlineState {
  let index = 0;
  let current = state;
  while (index < line.length) {
    const step = stepInline(line, index, lineStart + index, length, current);
    index = step.index;
    current = step.state;
  }
  return current;
}
