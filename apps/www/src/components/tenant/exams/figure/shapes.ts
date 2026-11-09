import {
  MathAppearanceSchema,
  MathLabelPlacementSchema,
  type PlanePoint,
  PlanePointSchema,
} from "@nakafa/aksara-contracts/math/base";
import type { FormulaScope } from "@nakafa/aksara-contracts/math/formula/compile";
import {
  type PlaneFormulaPoint,
  PlaneFormulaPointSchema,
} from "@nakafa/aksara-contracts/math/formula/field";
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
 * inequality on each line of `formula`. `label` is LaTeX, empty for none.
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
const pointOf = (x: string, y: string) =>
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

/** The point and the angle of the end of an arm of an angle, at its radius. */
const armEnd = (vertex: PlanePoint, radius: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: vertex.x + radius * Math.cos(radians),
    y: vertex.y + radius * Math.sin(radians),
  };
};

/** The arc of an angle: its vertex, its radius, and the turn from one arm to the other. */
const angleOf = (shape: ShapeDraft) =>
  Option.map(
    Option.all({
      center: pointOf(shape.x, shape.y),
      from: numberOf(shape.from),
      radius: numberOf(shape.r),
      to: numberOf(shape.to),
    }),
    ({ center, from, radius, to }) => ({
      center,
      kind: "arc" as const,
      radius,
      startDegrees: from,
      sweepDegrees: to - from,
    })
  );

/** The two ends of a segment, a line, a ray or a vector. */
const endsOf = (shape: ShapeDraft) =>
  Option.all([pointOf(shape.x, shape.y), pointOf(shape.x2, shape.y2)]);

/**
 * The MathVisual object of a shape, without its id and role, or none while a number is missing.
 * The contract checks the rest: a formula that does not read, two ends that coincide, a radius
 * that is no length. A point whose coordinates are formulas of the sliders is a marker that
 * follows them.
 */
export const objectOf = (shape: ShapeDraft) =>
  Match.value(shape.kind).pipe(
    Match.when("point", () =>
      Option.match(pointOf(shape.x, shape.y), {
        onNone: () =>
          Option.some({ kind: "marker" as const, x: shape.x, y: shape.y }),
        onSome: (at) => Option.some({ at, kind: "point" as const }),
      })
    ),
    Match.when("line", () =>
      Option.map(endsOf(shape), (through) => ({
        kind: "line" as const,
        through,
      }))
    ),
    Match.when("ray", () =>
      Option.map(endsOf(shape), ([from, through]) => ({
        from,
        kind: "ray" as const,
        through,
      }))
    ),
    Match.whenOr("segment", "vector", (kind) =>
      Option.map(endsOf(shape), ([from, to]) => ({ from, kind, to }))
    ),
    Match.when("polygon", () =>
      Option.map(cornersOf(shape.formula), (vertices) => ({
        kind: "polygon" as const,
        vertices,
      }))
    ),
    Match.when("circle", () =>
      Option.map(
        Option.all({
          center: pointOf(shape.x, shape.y),
          radius: numberOf(shape.r),
        }),
        ({ center, radius }) => ({ center, kind: "circle" as const, radius })
      )
    ),
    Match.when("angle", () => angleOf(shape)),
    Match.when("function", () =>
      Option.map(
        Option.all({ max: numberOf(shape.to), min: numberOf(shape.from) }),
        (domain) => ({
          domain,
          formula: shape.formula,
          kind: "function" as const,
        })
      )
    ),
    Match.when("equation", () =>
      Option.some({ equation: shape.formula, kind: "implicit" as const })
    ),
    Match.when("region", () =>
      Option.some({
        inequalities: inequalitiesOf(shape.formula),
        kind: "region" as const,
      })
    ),
    Match.exhaustive
  );

/** The middle of two points. */
const middle = ([from, to]: readonly [PlanePoint, PlanePoint]) => ({
  x: (from.x + to.x) / 2,
  y: (from.y + to.y) / 2,
});

/** Where a label stands: an exact point, or one the sliders move, and its side of that point. */
const Anchor = Schema.Struct({
  at: Schema.Union([PlanePointSchema, PlaneFormulaPointSchema]),
  placement: MathLabelPlacementSchema,
});
type Anchor = typeof Anchor.Type;

/**
 * Where a shape's label stands, as the contract places an anchor: a point at its point, a segment
 * at its middle, a circle on its top, an angle beside its arc, a function near the end of its
 * range. None while a number is missing, or for a kind that carries no label.
 */
export const anchorOf = (
  shape: ShapeDraft,
  scope: FormulaScope
): Option.Option<Anchor> =>
  Match.value(shape.kind).pipe(
    Match.when("point", () =>
      Option.some({
        at: Option.getOrElse<PlanePoint, PlaneFormulaPoint>(
          pointOf(shape.x, shape.y),
          () => ({ x: shape.x, y: shape.y })
        ),
        placement: "above-right" as const,
      })
    ),
    Match.whenOr("segment", "line", "ray", "vector", () =>
      Option.map(endsOf(shape), (ends) => ({
        at: middle(ends),
        placement: "above" as const,
      }))
    ),
    Match.when("polygon", () =>
      Option.flatMap(cornersOf(shape.formula), (corners) =>
        Option.map(Arr.head(corners), () => ({
          at: {
            x: Arr.reduce(corners, 0, (sum, { x }) => sum + x) / corners.length,
            y: Arr.reduce(corners, 0, (sum, { y }) => sum + y) / corners.length,
          },
          placement: "center" as const,
        }))
      )
    ),
    Match.when("circle", () =>
      Option.map(
        Option.all({
          center: pointOf(shape.x, shape.y),
          radius: numberOf(shape.r),
        }),
        ({ center, radius }) => ({
          at: { x: center.x, y: center.y + radius },
          placement: "above" as const,
        })
      )
    ),
    Match.when("angle", () =>
      Option.map(
        angleOf(shape),
        ({ center, radius, startDegrees, sweepDegrees }) => ({
          at: armEnd(center, radius * 1.6, startDegrees + sweepDegrees / 2),
          placement: "center" as const,
        })
      )
    ),
    Match.when("function", () =>
      Option.flatMap(
        Option.all({ max: numberOf(shape.to), min: numberOf(shape.from) }),
        ({ max, min }) => {
          const x = min + (max - min) * 0.8;
          return Option.map(valueAt(shape.formula, scope, x), (y) => ({
            at: { x, y },
            placement: "right" as const,
          }));
        }
      )
    ),
    Match.orElse(() => Option.none())
  );
