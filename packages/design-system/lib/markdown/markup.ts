import { Brand } from "effect";

/**
 * KaTeX markup, packed for the RSC payload by {@link packMathMarkup}.
 *
 * Next inlines the payload in the page as JavaScript strings, where every `<`,
 * `>`, and `&` becomes a six-byte escape and every `"` and `\` costs two to
 * four bytes. KaTeX's markup is made mostly of those characters, so a
 * formula's payload copy used to outweigh the markup it describes. Packed
 * markup spells them, and the tags KaTeX writes most often, as two-byte tokens
 * that need no escape, and {@link unpackMathMarkup} restores the exact markup.
 */
export type PackedMathMarkup = Brand.Branded<string, "PackedMathMarkup">;

const PackedMathMarkup = Brand.nominal<PackedMathMarkup>();

/** Starts every token; the marker's own token keeps a literal marker. */
const MARKER = "~";

/**
 * What each token stands for. A token is the marker and one printable ASCII
 * symbol that the payload never escapes. The first entries cover the
 * characters the payload escapes and the syntax every tag shares; the rest
 * are the tags KaTeX writes most often, ranked by the bytes each saved across
 * the 2,222 distinct formulas of the acceptance lessons. Markup outside this
 * table still packs and unpacks exactly; it only saves less.
 */
const EXPANSIONS: Readonly<Record<string, string>> = {
  [MARKER]: MARKER,
  "!": "<",
  "#": ">",
  $: '"',
  "%": "&",
  "'": "\\",
  "(": "</span>",
  ")": '<span class="',
  "*": '<span style="',
  "+": '" style="',
  ",": '">',
  "-": '<annotation encoding="application/x-tex">',
  ".": "</mo>",
  "/": '<mo stretchy="false">',
  0: '<math xmlns="http://www.w3.org/1998/Math/MathML">',
  1: "</mn>",
  2: "</mi>",
  3: "<mn>",
  4: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">',
  5: "</mrow>",
  6: "<mi>",
  7: "<mrow>",
  8: "<mo>",
  9: '<mstyle scriptlevel="0" displaystyle="true">',
  ":": "</annotation>",
  ";": "</semantics>",
  "=": "<semantics>",
  "?": "</math>",
  "@": "</msup>",
  A: "<msup>",
  B: "</mstyle>",
  C: '<mtable rowspacing="0.25em" columnalign="right left" columnspacing="0em">',
  D: "</mtd>",
  E: "<mtd>",
  F: '<mo separator="true">',
  G: '<span class="mord">',
  H: '<span class="mspace" style="margin-right:0.2778em;">',
  I: '<span class="mspace" style="margin-right:0.2222em;">',
  J: '<span class="katex-base">',
  K: '<span class="vlist-r">',
  L: '<span class="pstrut" style="height:3em;">',
  M: '<span class="katex-sizing reset-size6 size3 mtight">',
  N: '<span class="katex-html" aria-hidden="true">',
  O: '<span class="mord mathnormal">',
  P: '<span class="pstrut" style="height:2.7em;">',
  Q: '<span class="mord mtight">',
  R: '<span class="katex-mathml">',
  S: '<span class="vlist-t vlist-t2">',
  T: '<span class="katex-strut" style="height:1em;vertical-align:-0.25em;">',
  U: '<span class="mrel">',
  V: '<span class="katex">',
  W: '<span class="vlist-s">',
  X: '<span class="msupsub">',
  Y: '<span class="katex-strut" style="height:0.6444em;">',
  Z: '<span class="mord mathnormal" style="margin-right:0.0359em;">',
  "[": '<span class="mbin">',
  "]": '<span class="frac-line" style="border-bottom-width:0.04em;">',
  "^": '<span class="mclose">',
  _: '<span class="mspace" style="margin-right:0.1667em;">',
  "`": '<span class="vlist-t">',
  a: '<span class="mopen">',
  b: '<span style="top:-3.113em;margin-right:0.05em;">',
  c: '<span class="katex-display">',
  d: '<span class="mclose nulldelimiter">',
  e: '<span class="mopen nulldelimiter">',
  f: '<span class="vlist" style="height:0.8641em;">',
  g: '<span style="top:-3.063em;margin-right:0.05em;">',
  h: '<span style="top:-3.23em;">',
  i: '<span class="mord mathnormal mtight">',
  j: '<span class="mord mathnormal" style="margin-right:0.0278em;">',
  k: '<span class="mord mathnormal" style="margin-right:0.1076em;">',
  l: '<span class="mfrac">',
  m: '<span class="vlist" style="height:0.686em;">',
  n: '<span class="katex-strut" style="height:0.8389em;vertical-align:-0.1944em;">',
  o: '<span class="hide-tail" style="min-width:0.853em;height:1.08em;">',
  p: '<span class="vlist" style="height:0.15em;">',
  q: '<span class="mpunct">',
  r: '<span class="katex-strut" style="height:0.7278em;vertical-align:-0.0833em;">',
  s: '<span style="top:-3.677em;">',
  t: '<span class="vlist" style="height:0.8141em;">',
  u: '<span style="top:-2.314em;">',
  v: '<span class="vlist" style="height:0.3011em;">',
  w: '<span class="svg-align" style="top:-3em;">',
  x: '<span class="mord" style="padding-left:0.833em;">',
  y: '<span class="mord text">',
  z: '<span style="top:-2.55em;margin-left:0em;margin-right:0.05em;">',
  "{": '<span class="vlist" style="height:1.3214em;">',
  "|": '<span class="katex-strut" style="height:0.4306em;">',
  "}": '<span class="katex-strut" style="height:0.8889em;vertical-align:-0.1944em;">',
};

const TOKENS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(EXPANSIONS).map(([symbol, fragment]) => [
    fragment,
    MARKER + symbol,
  ])
);

const REGEXP_SYNTAX = /[.*+?^${}()|[\]\\]/g;

/** Matches the longest fragment first, so a tag outranks its first character. */
const PACKABLE = new RegExp(
  Object.keys(TOKENS)
    .sort((left, right) => right.length - left.length)
    .map((fragment) => fragment.replace(REGEXP_SYNTAX, "\\$&"))
    .join("|"),
  "g"
);

/** Packs one formula's KaTeX markup into its payload form. */
export function packMathMarkup(markup: string): PackedMathMarkup {
  return PackedMathMarkup(
    markup.replace(PACKABLE, (fragment) => TOKENS[fragment])
  );
}

/** Restores the exact markup that {@link packMathMarkup} packed. */
export function unpackMathMarkup(packed: PackedMathMarkup): string {
  let markup = "";
  let start = 0;
  let marker = packed.indexOf(MARKER);
  while (marker >= 0) {
    markup += packed.slice(start, marker) + EXPANSIONS[packed[marker + 1]];
    start = marker + 2;
    marker = packed.indexOf(MARKER, start);
  }
  return markup + packed.slice(start);
}
