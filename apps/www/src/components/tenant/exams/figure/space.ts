import type { FigureAttrs } from "@nakafa/aksara-contracts/assessment/figure";
import type { SpacePoint } from "@nakafa/aksara-contracts/math/base";
import type { FormulaScope } from "@nakafa/aksara-contracts/math/formula/compile";
import { compileText } from "@nakafa/aksara-contracts/math/formula/plane";
import { Array as Arr, Match, Option, Result } from "effect";
import {
  numberOf,
  type ShapeDraft,
  type ShapeKind,
} from "@/components/tenant/exams/figure/shapes";

/** The objects a teacher puts in space, which MathVisual draws in three dimensions. */
export const SPACE_KINDS: readonly ShapeKind[] = [
  "point",
  "segment",
  "line",
  "ray",
  "vector",
  "function",
];

/** The samples of a surface's domain along each axis that the fit reads. */
const SURFACE_SAMPLES = 8;

/** A typed point of space, or none while a coordinate is no number. */
const spacePointOf = (x: string, y: string, z: string) =>
  Option.all({ x: numberOf(x), y: numberOf(y), z: numberOf(z) });

/** The two ends of a segment, a line, a ray or a vector in space. */
const endsOf = (shape: ShapeDraft) =>
  Option.all([
    spacePointOf(shape.x, shape.y, shape.z),
    spacePointOf(shape.x2, shape.y2, shape.z2),
  ]);

/**
 * The MathVisual object of a shape in space, without its id and role: a point, a segment, a line, a ray, a
 * vector, or the surface z = f(x, y) over the square from `from` to `to` on both axes. None while a number is
 * missing, or for a kind that only a plane draws.
 */
export const spaceObjectOf = (shape: ShapeDraft) =>
  Match.value(shape.kind).pipe(
    Match.when("point", () =>
      Option.map(spacePointOf(shape.x, shape.y, shape.z), (at) => ({
        at,
        kind: "point" as const,
      }))
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
    Match.when("function", () =>
      Option.map(
        Option.all({ max: numberOf(shape.to), min: numberOf(shape.from) }),
        (range) => ({
          domain: { x: range, y: range },
          formula: shape.formula,
          kind: "function" as const,
        })
      )
    ),
    Match.orElse(() => Option.none())
  );

/** Where a label stands in space: a point at its point; a segment, a line, a ray and a vector at their middle. */
export const spaceAnchorOf = (shape: ShapeDraft) =>
  Match.value(shape.kind).pipe(
    Match.when("point", () => spacePointOf(shape.x, shape.y, shape.z)),
    Match.whenOr("segment", "line", "ray", "vector", () =>
      Option.map(endsOf(shape), ([from, to]) => ({
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2,
        z: (from.z + to.z) / 2,
      }))
    ),
    Match.orElse(() => Option.none<SpacePoint>())
  );

/** The heights of a surface over a grid of its domain, with the sliders at their values, where it has one. */
const surfaceSpots = (
  formula: string,
  scope: FormulaScope,
  range: { readonly max: number; readonly min: number }
) =>
  Option.match(Result.getSuccess(compileText(formula)), {
    onNone: Arr.empty<SpacePoint>,
    onSome: (evaluate) => {
      const steps = Arr.map(
        Arr.range(0, SURFACE_SAMPLES),
        (step) => range.min + ((range.max - range.min) * step) / SURFACE_SAMPLES
      );
      return Arr.flatMap(steps, (x) =>
        Arr.flatMap(steps, (y) => {
          const z = evaluate({ ...scope, x, y });
          return Number.isFinite(z) ? [{ x, y, z }] : [];
        })
      );
    },
  });

/** The points of a shape in space that the frame must hold. */
export const spaceSpotsOf = (
  shape: ShapeDraft,
  scope: FormulaScope
): readonly SpacePoint[] =>
  Option.match(spaceObjectOf(shape), {
    onNone: Arr.empty,
    onSome: (object) =>
      Match.value(object).pipe(
        Match.when({ kind: "point" }, ({ at }) => [at]),
        Match.when({ kind: "line" }, ({ through }) => through),
        Match.when({ kind: "ray" }, ({ from, through }) => [from, through]),
        Match.whenOr(
          { kind: "segment" },
          { kind: "vector" },
          ({ from, to }) => [from, to]
        ),
        Match.when({ kind: "function" }, ({ domain, formula }) =>
          surfaceSpots(formula, scope, domain.x)
        ),
        Match.exhaustive
      ),
  });

/** One object of a stored space scene. */
type SpaceObject = Extract<
  Extract<FigureAttrs, { readonly component: "MathVisual" }>["props"]["scene"],
  { readonly space: "space" }
>["objects"][number];

/** The two ends of a stored segment as the fields hold them. */
const endFields = (from: SpacePoint, to: SpacePoint) => ({
  x: String(from.x),
  x2: String(to.x),
  y: String(from.y),
  y2: String(to.y),
  z: String(from.z),
  z2: String(to.z),
});

/**
 * The fields of a stored space object as the builder holds them, or none for one the builder does not write:
 * a solid, a parametric curve or surface, or a surface whose domain is no square.
 */
export const spaceFieldsOf = (
  object: SpaceObject
): Option.Option<Partial<ShapeDraft> & Pick<ShapeDraft, "kind">> =>
  Match.value(object).pipe(
    Match.when({ kind: "point" }, ({ at }) =>
      Option.some({
        kind: "point" as const,
        x: String(at.x),
        y: String(at.y),
        z: String(at.z),
      })
    ),
    Match.whenOr(
      { kind: "segment" },
      { kind: "vector" },
      ({ from, kind, to }) => Option.some({ kind, ...endFields(from, to) })
    ),
    Match.when({ kind: "line" }, ({ through: [from, to] }) =>
      Option.some({ kind: "line" as const, ...endFields(from, to) })
    ),
    Match.when({ kind: "ray" }, ({ from, through }) =>
      Option.some({ kind: "ray" as const, ...endFields(from, through) })
    ),
    Match.when({ kind: "function" }, ({ domain, formula }) =>
      domain === undefined ||
      domain.x.min !== domain.y.min ||
      domain.x.max !== domain.y.max
        ? Option.none()
        : Option.some({
            formula,
            from: String(domain.x.min),
            kind: "function" as const,
            to: String(domain.x.max),
          })
    ),
    Match.orElse(() => Option.none())
  );
