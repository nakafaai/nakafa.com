import {
  MathAppearanceSchema,
  type PlanePoint,
} from "@nakafa/aksara-contracts/math/base";
import type { FormulaScope } from "@nakafa/aksara-contracts/math/formula/compile";
import {
  readFormula,
  readRelation,
} from "@nakafa/aksara-contracts/math/formula/parse";
import { compileText } from "@nakafa/aksara-contracts/math/formula/plane";
import {
  Array as Arr,
  Match,
  Option,
  pipe,
  Result,
  Schema,
  String as Str,
} from "effect";

/**
 * The objects a teacher puts on a plane, in the order the add menu lists them. Each one is a
 * MathVisual object: a function, an equation and a region read formulas of x, y and the sliders.
 */
export const ShapeKind = Schema.Literals([
  "point",
  "segment",
  "line",
  "ray",
  "vector",
  "polygon",
  "circle",
  "angle",
  "function",
  "equation",
  "region",
]);
export type ShapeKind = typeof ShapeKind.Type;

/**
 * One object as its fields hold it, every number as typed, so a value on its way never jumps.
 * Each kind reads its own fields: a point `x` and `y`; a segment, a line, a ray and a vector
 * `x`, `y` to `x2`, `y2`; a circle its center `x`, `y` and radius `r`; an angle its vertex `x`,
 * `y`, radius `r`, and the directions `from` and `to` in degrees; a function its `formula` of
 * x from `from` to `to`; a polygon its corners, an equation its equation, and a region one
 * inequality on each line of `formula`. In space a point and the ends of a segment also read `z`
 * and `z2`, and a function draws the surface z = f(x, y). `label` is LaTeX, empty for none.
 */
export const ShapeDraft = Schema.Struct({
  appearance: MathAppearanceSchema,
  formula: Schema.String,
  from: Schema.String,
  id: Schema.String,
  kind: ShapeKind,
  label: Schema.String,
  r: Schema.String,
  to: Schema.String,
  x: Schema.String,
  x2: Schema.String,
  y: Schema.String,
  y2: Schema.String,
  z: Schema.String,
  z2: Schema.String,
});
export type ShapeDraft = typeof ShapeDraft.Type;

/** The kinds whose label stands at a point the builder knows; an equation and a region carry none. */
export const LABELLED: readonly ShapeKind[] = [
  "point",
  "segment",
  "line",
  "ray",
  "vector",
  "polygon",
  "circle",
  "angle",
  "function",
];

/** The role each new object takes, so two objects in a row differ. */
const APPEARANCES = [
  "primary",
  "secondary",
  "highlight",
  "answer",
] as const satisfies readonly (typeof MathAppearanceSchema.Type)[];

/** The fields every kind starts from: a shape at the origin, on the role its place gives it. */
const blankShape = (kind: ShapeKind, id: string, place: number) => ({
  appearance: Arr.headNonEmpty(Arr.rotate(APPEARANCES, -place)),
  formula: "",
  from: "",
  id,
  kind,
  label: "",
  r: "",
  to: "",
  x: "0",
  x2: "",
  y: "0",
  y2: "",
  z: "0",
  z2: "",
});

/** A new object of a kind, already drawn, so the preview shows it at once and the teacher edits from there. */
export const newShape = (
  kind: ShapeKind,
  id: string,
  place: number
): ShapeDraft => {
  const blank = blankShape(kind, id, place);
  return Match.value(kind).pipe(
    Match.whenOr("segment", "line", "ray", "vector", () => ({
      ...blank,
      x2: "3",
      y2: "2",
      z2: "1",
    })),
    Match.when("polygon", () => ({
      ...blank,
      formula: "(0, 0) (4, 0) (0, 3)",
    })),
    Match.when("circle", () => ({ ...blank, r: "2" })),
    Match.when("angle", () => ({ ...blank, from: "0", r: "1", to: "60" })),
    Match.when("function", () => ({
      ...blank,
      formula: "x^2",
      from: "-2",
      to: "2",
    })),
    Match.when("equation", () => ({ ...blank, formula: "x^2 + y^2 = 4" })),
    Match.when("region", () => ({ ...blank, formula: "y >= x^2\ny <= 4" })),
    Match.orElse(() => blank)
  );
};

/** The number a teacher typed, with either decimal point, or none when it is empty or no number. */
export const numberOf = (text: string) =>
  Option.flatMap(
    Option.liftPredicate(
      pipe(text, Str.trim, Str.replace(",", ".")),
      Str.isNonEmpty
    ),
    Schema.decodeOption(Schema.FiniteFromString)
  );

/** Whether a field holds a number. */
export const isNumber = (text: string) => Option.isSome(numberOf(text));

/** Whether a field holds a formula the contract reads, such as `2x + 1` or `a sin(x)`. */
export const isFormula = (text: string) => Result.isSuccess(readFormula(text));

/** Whether a field holds an equation, with `=`. */
export const isEquation = (text: string) =>
  Result.match(readRelation(text), {
    onFailure: () => false,
    onSuccess: ({ comparison }) => comparison === "=",
  });

/** Whether every line of a field holds an inequality, with `<`, `<=`, `>` or `>=`, and one line at least. */
export const isInequalities = (text: string) => {
  const lines = inequalitiesOf(text);
  return (
    Arr.isReadonlyArrayNonEmpty(lines) &&
    Arr.every(lines, (line) =>
      Result.match(readRelation(line), {
        onFailure: () => false,
        onSuccess: ({ comparison }) => comparison !== "=",
      })
    )
  );
};

/** A typed coordinate pair as a point of the plane, or none while either is no number. */
export const pointOf = (x: string, y: string) =>
  Option.all({ x: numberOf(x), y: numberOf(y) });

/** Whether the parts of a corner are its two coordinates. */
const isPair = (parts: readonly string[]): parts is readonly [string, string] =>
  parts.length === 2;

/** One corner written as `(x, y)`, its closing bracket already split off, or none when it is no pair of numbers. */
const cornerOf = (part: string) =>
  Option.flatMap(
    Option.liftPredicate(
      Str.split(pipe(part, Str.trim, Str.replace("(", "")), ","),
      isPair
    ),
    ([x, y]) => pointOf(x, y)
  );

/** The corners of a polygon written as `(x, y)` pairs, or none while one of them is no pair of numbers. */
export const cornersOf = (text: string) =>
  pipe(
    Str.split(text, ")"),
    Arr.filter((part) => Str.isNonEmpty(Str.trim(part))),
    Arr.map(cornerOf),
    Option.all
  );

/** The corners of a polygon as a teacher reads them. */
export const cornersText = (corners: readonly PlanePoint[]) =>
  Arr.join(
    Arr.map(corners, ({ x, y }) => `(${x}, ${y})`),
    " "
  );

/** The inequalities of a region, one on each line, without empty lines. */
export const inequalitiesOf = (text: string) =>
  pipe(Str.split(text, "\n"), Arr.map(Str.trim), Arr.filter(Str.isNonEmpty));

/** The value of a formula of x at one x, with the sliders at their values, or none where it has none. */
export const valueAt = (formula: string, scope: FormulaScope, x: number) =>
  Option.filter(
    Option.map(Result.getSuccess(compileText(formula)), (evaluate) =>
      evaluate({ ...scope, x })
    ),
    Number.isFinite
  );
