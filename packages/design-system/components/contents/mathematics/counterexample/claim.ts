import { Array as Arr, Match, Option, Schema } from "effect";

/**
 * The tiles on the table, the tests a tile passes or fails, the claims made
 * about the tiles, and what each tile does to a claim. A claim about every
 * tile ("all"), about at least one tile ("some"), or an implication ("if p,
 * then q") is checked case by case: each tile is one case.
 */

/** The shapes a shape tile can carry. */
const ShapeSchema = Schema.Literals(["circle", "square", "triangle"]);

/** The paints a shape can wear. */
const ColourSchema = Schema.Literals(["red", "blue", "yellow", "green"]);

/** What one tile shows: a whole number printed on it, or a painted shape standing on it. */
const TileSchema = Schema.Union([
  Schema.TaggedStruct("number", { value: Schema.Int }),
  Schema.TaggedStruct("shape", { colour: ColourSchema, shape: ShapeSchema }),
]);
export type Tile = typeof TileSchema.Type;

/**
 * A test a tile passes or fails. The number tests read a number tile: odd,
 * even, prime, a square number, a multiple of `of`, a factor of `of`, more
 * than `than`, or less than `than`. The shape tests read a shape tile: its
 * shape or its colour. A test of the other kind of tile fails.
 */
const TestSchema = Schema.Union([
  Schema.TaggedStruct("odd", {}),
  Schema.TaggedStruct("even", {}),
  Schema.TaggedStruct("prime", {}),
  Schema.TaggedStruct("square-number", {}),
  Schema.TaggedStruct("multiple", { of: Schema.Int }),
  Schema.TaggedStruct("factor", { of: Schema.Int }),
  Schema.TaggedStruct("above", { than: Schema.Number }),
  Schema.TaggedStruct("below", { than: Schema.Number }),
  Schema.TaggedStruct("shape", { shape: ShapeSchema }),
  Schema.TaggedStruct("colour", { colour: ColourSchema }),
]);
export type Test = typeof TestSchema.Type;

/** A test with the words the footer names it by, such as "Odd number". */
const NamedTestSchema = Schema.Struct({
  name: Schema.String,
  test: TestSchema,
});

/**
 * A claim about the tiles. "all" says every tile that passes `subject` (every
 * tile, without one) passes `predicate`; "some" says at least one does. "if"
 * says every tile that passes `p` passes `q`.
 */
const ClaimSchema = Schema.Union([
  Schema.TaggedStruct("all", {
    predicate: NamedTestSchema,
    subject: Schema.optional(NamedTestSchema),
  }),
  Schema.TaggedStruct("some", {
    predicate: NamedTestSchema,
    subject: Schema.optional(NamedTestSchema),
  }),
  Schema.TaggedStruct("if", { p: NamedTestSchema, q: NamedTestSchema }),
]);
export type Claim = typeof ClaimSchema.Type;

/** One tile of a lesson: what it shows, and its name in the tile list and the footer, such as "9" or "red square". */
export const TileEntrySchema = Schema.Struct({
  name: Schema.String,
  tile: TileSchema,
});

/**
 * One claim of a lesson: the claim, its short name on the toolbar's toggle,
 * such as "All", and its text printed on the card, such as "All odd numbers
 * here are prime".
 */
export const ClaimEntrySchema = Schema.Struct({
  claim: ClaimSchema,
  name: Schema.String,
  text: Schema.String,
});

/**
 * What one tile does to a claim. For "all" and "if", a tile that passes the
 * first test and fails the second `breaks` the claim (a counterexample), one
 * that passes both `fits` it. For "some", a tile that passes both `proves`
 * the claim (an example), one that passes only the first `misses`. A tile
 * that fails the first test is `outside` a claim about all or some, and
 * `safe` for an implication, which it can never break.
 */
const VerdictSchema = Schema.Literals([
  "breaks",
  "fits",
  "outside",
  "proves",
  "misses",
  "safe",
]);
export type Verdict = typeof VerdictSchema.Type;

/** Whether one tile passes the two tests of a claim: `p`, the condition or subject, and `q`. */
const CaseSchema = Schema.Struct({ p: Schema.Boolean, q: Schema.Boolean });
export type Case = typeof CaseSchema.Type;

/** Whether a whole number is prime: more than 1, with no factor but 1 and itself. */
function isPrime(value: number) {
  if (value < 2) {
    return false;
  }
  return Arr.every(
    Arr.range(2, Math.max(2, Math.floor(Math.sqrt(value)))),
    (factor) => factor === value || value % factor !== 0
  );
}

/** Whether a whole number is a square number: 0, 1, 4, 9, and so on. */
function isSquare(value: number) {
  return value >= 0 && Number.isInteger(Math.sqrt(value));
}

/** Whether a number test passes on one number. */
function numberPasses(test: Test, value: number) {
  return Match.valueTags(test, {
    above: ({ than }) => value > than,
    below: ({ than }) => value < than,
    colour: () => false,
    even: () => value % 2 === 0,
    factor: ({ of }) => value !== 0 && of % value === 0,
    multiple: ({ of }) => (of === 0 ? value === 0 : value % of === 0),
    odd: () => Math.abs(value % 2) === 1,
    prime: () => isPrime(value),
    shape: () => false,
    "square-number": () => isSquare(value),
  });
}

/** Whether a tile passes a test. */
export function passes(test: Test, tile: Tile): boolean {
  return Match.valueTags(tile, {
    number: ({ value }) => numberPasses(test, value),
    shape: ({ colour, shape }) =>
      (test._tag === "shape" && test.shape === shape) ||
      (test._tag === "colour" && test.colour === colour),
  });
}

/** The first test of a claim, the subject or the condition, when it has one. */
export function firstTest(claim: Claim) {
  return claim._tag === "if"
    ? Option.some(claim.p)
    : Option.fromUndefinedOr(claim.subject);
}

/** The second test of a claim, its predicate or its conclusion. */
export function secondTest(claim: Claim) {
  return claim._tag === "if" ? claim.q : claim.predicate;
}

/** Whether one tile passes each test of a claim; a claim about every tile has no first test to fail. */
export function caseOf(claim: Claim, tile: Tile): Case {
  return {
    p: Option.match(firstTest(claim), {
      onNone: () => true,
      onSome: (first) => passes(first.test, tile),
    }),
    q: passes(secondTest(claim).test, tile),
  };
}

/** What one tile does to a claim. */
export function verdictOf(claim: Claim, tile: Tile): Verdict {
  const { p, q } = caseOf(claim, tile);
  if (!p) {
    return claim._tag === "if" ? "safe" : "outside";
  }
  if (claim._tag === "some") {
    return q ? "proves" : "misses";
  }
  return q ? "fits" : "breaks";
}

/**
 * The verdicts a claim can give, in the order the footer's key lists them:
 * the one that settles it first. A claim about every tile has no tile outside it.
 */
export function verdictsOf(claim: Claim): readonly Verdict[] {
  if (claim._tag === "if") {
    return ["breaks", "fits", "safe"];
  }
  const inside: readonly Verdict[] =
    claim._tag === "all" ? ["breaks", "fits"] : ["proves", "misses"];
  return claim.subject === undefined ? inside : [...inside, "outside"];
}

/**
 * The tile that settles a claim, in the order the tiles are checked: the
 * first counterexample of "all" or "if", which makes it false, or the first
 * example of "some", which makes it true. None settles a claim that holds for
 * all, or a "some" with no example, until every tile has been checked.
 */
export function deciderOf(claim: Claim, tiles: readonly Tile[]) {
  const settles: Verdict = claim._tag === "some" ? "proves" : "breaks";
  return Arr.findFirstIndex(
    tiles,
    (tile) => verdictOf(claim, tile) === settles
  );
}

/** Whether a claim is true of the tiles on the table. */
export function holds(claim: Claim, tiles: readonly Tile[]) {
  return Option.isSome(deciderOf(claim, tiles)) === (claim._tag === "some");
}
