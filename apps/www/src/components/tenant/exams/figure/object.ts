import {
  MathLabelPlacementSchema,
  type PlanePoint,
  PlanePointSchema,
} from "@nakafa/aksara-contracts/math/base";
import type { FormulaScope } from "@nakafa/aksara-contracts/math/formula/compile";
import {
  type PlaneFormulaPoint,
  PlaneFormulaPointSchema,
} from "@nakafa/aksara-contracts/math/formula/field";
import { Array as Arr, Match, Option, Schema } from "effect";
import {
  cornersOf,
  inequalitiesOf,
  numberOf,
  pointOf,
  type ShapeDraft,
  valueAt,
} from "@/components/tenant/exams/figure/shapes";

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

/** The samples of a function's range that the fit reads. */
const FIT_SAMPLES = 40;

/** The points of a shape that the plane must show. */
export const planeSpotsOf = (
  shape: ShapeDraft,
  scope: FormulaScope
): readonly PlanePoint[] =>
  Option.getOrElse(
    Option.map(objectOf(shape), (object) =>
      Match.value(object).pipe(
        Match.when({ kind: "point" }, ({ at }) => [at]),
        Match.when({ kind: "marker" }, ({ x, y }) =>
          Option.getOrElse(
            Option.map(
              Option.all({ x: valueAt(x, scope, 0), y: valueAt(y, scope, 0) }),
              Arr.of
            ),
            Arr.empty
          )
        ),
        Match.when({ kind: "line" }, ({ through }) => through),
        Match.when({ kind: "ray" }, ({ from, through }) => [from, through]),
        Match.whenOr(
          { kind: "segment" },
          { kind: "vector" },
          ({ from, to }) => [from, to]
        ),
        Match.when({ kind: "polygon" }, ({ vertices }) => vertices),
        Match.whenOr(
          { kind: "circle" },
          { kind: "arc" },
          ({ center, radius }) => [
            { x: center.x - radius, y: center.y - radius },
            { x: center.x + radius, y: center.y + radius },
          ]
        ),
        Match.when({ kind: "function" }, ({ domain, formula }) =>
          Arr.getSomes(
            Arr.map(Arr.range(0, FIT_SAMPLES), (step) => {
              const x =
                domain.min + ((domain.max - domain.min) * step) / FIT_SAMPLES;
              return Option.map(valueAt(formula, scope, x), (y) => ({ x, y }));
            })
          )
        ),
        Match.orElse(() => [])
      )
    ),
    Arr.empty
  );
