import { Array as Arr } from "effect";

/**
 * Reports Tailwind arbitrary values that repeat a value a built-in class
 * already renders, with that class. Tailwind finds class candidates by
 * scanning raw file text, so this policy scans the same text.
 *
 * Scales whose steps change with the active theme, such as radius, font size,
 * tracking, blur and shadow, stay out: their arbitrary values can be correct.
 */

type Resolve = (value: string) => string | undefined;

const TEST_MODULE_PATTERN = /\.test\.tsx?$/u;
// A utility with a bracketed value, not followed by `:` (that is a variant).
const CANDIDATE_PATTERN =
  /(?<![\w[\]-])(-?)([a-z][a-z0-9-]*?)-\[([^\]\s"'`]+)\](?![\w:-])/gu;
const LENGTH_PATTERN = /^(\d*\.?\d+)(px|rem)$/u;
const PERCENT_PATTERN = /^(\d+)(?:\.(\d+))?%$/u;
const PIXELS_PATTERN = /^(\d+)px$/u;
const INTEGER_PATTERN = /^\d+$/u;
const DECIMAL_PATTERN = /^\d*\.?\d+$/u;
const MILLISECONDS_PATTERN = /^(\d+)ms$/u;
const SECONDS_PATTERN = /^(\d*\.?\d+)s$/u;
const DEGREES_PATTERN = /^(\d+)deg$/u;
const RATIO_PATTERN = /^(\d+)\/(\d+)$/u;
const GRID_PATTERN = /^repeat\((\d+),_?minmax\(0,_?1fr\)\)$/u;
const BOUND_PREFIX_PATTERN = /^(?:min|max)-/u;

const REM_PIXELS = 16;
const STEP_PIXELS = 4;
const LARGEST_DENOMINATOR = 12;
const ROUNDING = 1e-9;

const SIZES = ["w", "h", "size", "min-w", "min-h", "max-w", "max-h", "basis"];
const INSETS = ["inset", "inset-x", "inset-y", "top", "right", "bottom"];
const SIDES = ["left", "start", "end", "translate-x", "translate-y"];
const MARGINS = ["m", "mx", "my", "mt", "mr", "mb", "ml", "ms", "me"];
const SCROLL_MARGINS = Arr.map(MARGINS, (margin) => `scroll-${margin}`);
const PADDINGS = ["p", "px", "py", "pt", "pr", "pb", "pl", "ps", "pe"];
const SCROLL_PADDINGS = Arr.map(PADDINGS, (padding) => `scroll-${padding}`);
const GAPS = ["gap", "gap-x", "gap-y", "space-x", "space-y"];
const TYPOGRAPHY_SPACING = ["indent", "leading", "border-spacing"];
const BORDERS = ["border", "border-x", "border-y", "border-t", "border-r"];
const BORDER_SIDES = ["border-b", "border-l", "border-s", "border-e"];
const DIVIDES = ["divide-x", "divide-y"];
const LINE_WIDTHS = ["ring", "ring-offset", "outline", "outline-offset"];
const TEXT_LINES = ["underline-offset", "decoration"];
const SCALES = ["scale", "scale-x", "scale-y"];
const GRID_LINES = ["col-start", "col-end", "row-start", "row-end"];
/** Utilities whose value is a whole number without a unit. */
const COUNTS = [
  ...["z", "order", "line-clamp", "stroke", "columns"],
  ...["grow", "shrink", "flex", "col-span", "row-span"],
  ...GRID_LINES,
];

/** Sizes and positions also take fractions of their container. */
const FRACTIONAL = new Set([...SIZES, ...INSETS, ...SIDES]);
/** A 1px border or divider is the bare class. */
const HAIRLINES = new Set([...BORDERS, ...BORDER_SIDES, ...DIVIDES]);
/** Utilities that take a leading `-` for a negative value. */
const NEGATABLE = new Set([
  ...INSETS,
  ...SIDES,
  ...MARGINS,
  ...SCROLL_MARGINS,
  "space-x",
  "space-y",
  "indent",
  "z",
  "order",
  "rotate",
  ...SCALES,
  ...GRID_LINES,
]);
const VIEWPORTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  h: { "100vh": "screen", "100dvh": "dvh", "100svh": "svh", "100lvh": "lvh" },
  w: { "100vw": "screen", "100dvw": "dvw", "100svw": "svw", "100lvw": "lvw" },
};

/** Returns the greatest common divisor of two non-negative integers. */
function gcd(left: number, right: number): number {
  return right === 0 ? left : gcd(right, left % right);
}

/** Returns the whole number a float stands for, if it is one. */
function wholeNumber(value: number) {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) < ROUNDING ? String(rounded) : undefined;
}

/** Returns the spacing step Tailwind renders for a px or rem length. */
function spacingStep(value: string) {
  if (value === "0") {
    return "0";
  }
  const match = LENGTH_PATTERN.exec(value);
  if (!match) {
    return;
  }
  const pixels = Number(match[1]) * (match[2] === "rem" ? REM_PIXELS : 1);
  if (!Number.isInteger(pixels)) {
    return;
  }
  if (pixels <= 1) {
    return pixels === 1 ? "px" : "0";
  }
  return String(pixels / STEP_PIXELS);
}

/** Returns the fraction class for a percentage with a small denominator. */
function fraction(value: string) {
  const match = PERCENT_PATTERN.exec(value);
  if (!match) {
    return;
  }
  const decimals = match[2] ?? "";
  const numerator = Number(`${match[1]}${decimals}`);
  const denominator = 100 * 10 ** decimals.length;
  const divisor = gcd(numerator, denominator);
  const top = numerator / divisor;
  const bottom = denominator / divisor;
  if (top === 0) {
    return "0";
  }
  if (top === bottom) {
    return "full";
  }
  return bottom <= LARGEST_DENOMINATOR ? `${top}/${bottom}` : undefined;
}

/** Resolves spacing, plus fractions and viewport units where the utility has them. */
function spacing(utility: string): Resolve {
  const axis = utility.replace(BOUND_PREFIX_PATTERN, "");
  return (value) =>
    spacingStep(value) ??
    (FRACTIONAL.has(utility) ? fraction(value) : undefined) ??
    VIEWPORTS[axis]?.[value];
}

/** Resolves a line width in whole pixels. */
function lineWidth(utility: string): Resolve {
  return (value) => {
    const pixels = value === "0" ? "0" : PIXELS_PATTERN.exec(value)?.[1];
    return pixels === "1" && HAIRLINES.has(utility) ? "" : pixels;
  };
}

/** Resolves a percentage written as a decimal or with `%`, such as 0.35. */
function percentStep(value: string) {
  if (value.endsWith("%")) {
    return wholeNumber(Number(value.slice(0, -1)));
  }
  return DECIMAL_PATTERN.test(value)
    ? wholeNumber(Number(value) * 100)
    : undefined;
}

/** Resolves a transition time as whole milliseconds. */
function milliseconds(value: string) {
  const whole = MILLISECONDS_PATTERN.exec(value)?.[1];
  if (whole !== undefined) {
    return whole;
  }
  const seconds = SECONDS_PATTERN.exec(value)?.[1];
  return seconds === undefined
    ? undefined
    : wholeNumber(Number(seconds) * 1000);
}

/** Resolves a whole-number aspect ratio, naming the square and video ones. */
function aspectRatio(value: string) {
  const match = RATIO_PATTERN.exec(value);
  if (!match) {
    return;
  }
  if (match[1] === match[2]) {
    return "square";
  }
  return value === "16/9" ? "video" : value;
}

/** Resolves a whole number without a unit. */
function integer(value: string) {
  return INTEGER_PATTERN.test(value) ? value : undefined;
}

/** Resolves an evenly divided grid track list. */
function gridTracks(value: string) {
  return GRID_PATTERN.exec(value)?.[1];
}

const RESOLVERS = new Map<string, Resolve>([
  ...Arr.map(
    [
      ...SIZES,
      ...INSETS,
      ...SIDES,
      ...MARGINS,
      ...SCROLL_MARGINS,
      ...PADDINGS,
      ...SCROLL_PADDINGS,
      ...GAPS,
      ...TYPOGRAPHY_SPACING,
    ],
    (utility): [string, Resolve] => [utility, spacing(utility)]
  ),
  ...Arr.map(
    [...BORDERS, ...BORDER_SIDES, ...DIVIDES, ...LINE_WIDTHS, ...TEXT_LINES],
    (utility): [string, Resolve] => [utility, lineWidth(utility)]
  ),
  ...Arr.map(COUNTS, (utility): [string, Resolve] => [utility, integer]),
  ...Arr.map(["opacity", ...SCALES], (utility): [string, Resolve] => [
    utility,
    percentStep,
  ]),
  ["duration", milliseconds],
  ["delay", milliseconds],
  ["rotate", (value) => DEGREES_PATTERN.exec(value)?.[1]],
  ["aspect", aspectRatio],
  ["grid-cols", gridTracks],
  ["grid-rows", gridTracks],
]);

/** Returns the built-in class that renders an arbitrary value, if one does. */
function builtInClass(negative: boolean, utility: string, value: string) {
  const valueNegative = value.startsWith("-");
  const suffix = RESOLVERS.get(utility)?.(
    valueNegative ? value.slice(1) : value
  );
  // A leading `-` on the utility or on the value negates it; both cancel out.
  const flipped = negative !== valueNegative;
  if (suffix === undefined || (flipped && !NEGATABLE.has(utility))) {
    return;
  }
  const name = suffix === "" ? utility : `${utility}-${suffix}`;
  return flipped ? `-${name}` : name;
}

/** Reports each arbitrary value in one authored module that repeats a class. */
export function inspectTailwindSource(file: string, sourceText: string) {
  if (TEST_MODULE_PATTERN.test(file)) {
    return [];
  }
  return Arr.flatMap([...sourceText.matchAll(CANDIDATE_PATTERN)], (match) => {
    const [candidate, negative, utility, value] = match;
    const replacement = builtInClass(negative === "-", utility, value);
    if (replacement === undefined) {
      return [];
    }
    const line = sourceText.slice(0, match.index).split("\n").length;
    return [`${file}:${line}: use ${replacement} instead of ${candidate}.`];
  });
}
