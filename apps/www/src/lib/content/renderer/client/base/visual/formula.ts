import {
  MathAppearanceSchema,
  SpacePointSchema,
} from "@nakafa/aksara-contracts/math/base";
import type { FormulaScope } from "@nakafa/aksara-contracts/math/formula/compile";
import type { FormulaReadout } from "@nakafa/aksara-contracts/math/formula/field";
import { isPlaneFormulaPoint } from "@nakafa/aksara-contracts/math/formula/field";
import type { FormulaGeometry } from "@nakafa/aksara-contracts/math/formula/plane";
import {
  compileText,
  planeFormulaGeometry,
  planeFormulaPoint,
} from "@nakafa/aksara-contracts/math/formula/plane";
import { spaceFormulaGeometry } from "@nakafa/aksara-contracts/math/formula/space";
import { Array as Arr, Option, Result, Schema } from "effect";
import { resolveVisualReach } from "@/lib/content/renderer/client/base/visual/reach";
import type {
  PlaneObject,
  PlaneVisual,
  SpaceObject,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import type { VisualProjection } from "@/lib/content/renderer/client/base/visual/transform";
import {
  projectVisualFrame,
  sampleProjector,
} from "@/lib/content/renderer/client/base/visual/transform";

const PointsSchema = Schema.Array(SpacePointSchema);
const ShapeFields = { appearance: MathAppearanceSchema, id: Schema.String };

/** One drawable piece of a formula object, already in scene units. */
const FormulaShapeSchema = Schema.Union([
  Schema.Struct({
    ...ShapeFields,
    /** A dashed graph shows points that do not belong to it, such as a strict boundary. */
    dashed: Schema.Boolean,
    kind: Schema.Literal("curve"),
    points: PointsSchema,
    /** An implicit curve runs to the reach, past every view, like a region. */
    unbounded: Schema.Boolean,
  }),
  Schema.Struct({
    ...ShapeFields,
    kind: Schema.Literal("marker"),
    point: SpacePointSchema,
  }),
  Schema.Struct({
    ...ShapeFields,
    boundary: Schema.Array(
      Schema.Struct({ points: PointsSchema, strict: Schema.Boolean })
    ),
    fill: Schema.Array(PointsSchema),
    kind: Schema.Literal("region"),
  }),
  Schema.Struct({
    ...ShapeFields,
    grid: Schema.Struct({
      columns: Schema.Int,
      points: Schema.Array(Schema.Option(SpacePointSchema)),
      rows: Schema.Int,
    }),
    kind: Schema.Literal("surface"),
    max: SpacePointSchema,
    min: SpacePointSchema,
  }),
  Schema.Struct({
    ...ShapeFields,
    faces: Schema.Array(PointsSchema),
    kind: Schema.Literal("solid"),
  }),
]);
export type FormulaShape = typeof FormulaShapeSchema.Type;

type PlaneFormula = Extract<
  PlaneObject,
  {
    readonly kind:
      | "function"
      | "implicit"
      | "loop"
      | "marker"
      | "parametric"
      | "path"
      | "polar"
      | "region";
  }
>;
type SpaceFormula = Extract<
  SpaceObject,
  {
    readonly kind:
      | "function"
      | "parametric"
      | "prism"
      | "pyramid"
      | "revolution"
      | "surface";
  }
>;

/** Whether a plane object is drawn from a formula. */
export function isPlaneFormula(object: PlaneObject): object is PlaneFormula {
  return (
    object.kind === "function" ||
    object.kind === "implicit" ||
    object.kind === "loop" ||
    object.kind === "marker" ||
    object.kind === "parametric" ||
    object.kind === "path" ||
    object.kind === "polar" ||
    object.kind === "region"
  );
}

/** Whether a space object is drawn from a formula or from its faces. */
export function isSpaceFormula(object: SpaceObject): object is SpaceFormula {
  return (
    object.kind === "function" ||
    object.kind === "parametric" ||
    object.kind === "prism" ||
    object.kind === "pyramid" ||
    object.kind === "revolution" ||
    object.kind === "surface"
  );
}

/** Projects every sampled piece of one formula object into the scene. */
function shapesOf(
  object: PlaneFormula | SpaceFormula,
  geometry: FormulaGeometry,
  project: (point: SpacePoint) => SpacePoint,
  frame: { readonly max: SpacePoint; readonly min: SpacePoint }
): readonly FormulaShape[] {
  const fields = { appearance: object.appearance, id: object.id };
  if (geometry.kind === "curves") {
    return Arr.map(geometry.branches, (branch, index) => ({
      ...fields,
      dashed: "stroke" in object && object.stroke === "dashed",
      id:
        geometry.branches.length === 1
          ? object.id
          : `${object.id}:part:${index + 1}`,
      kind: "curve" as const,
      points: Arr.map(branch, project),
      unbounded: object.kind === "implicit",
    }));
  }
  if (geometry.kind === "points") {
    // A marker places one point, or none where its formulas are not finite.
    return Arr.map(geometry.points, (point) => ({
      ...fields,
      id: object.id,
      kind: "marker" as const,
      point: project(point),
    }));
  }
  if (geometry.kind === "region") {
    return [
      {
        ...fields,
        boundary: Arr.map(geometry.boundary, (edge) => ({
          points: Arr.map(edge.points, project),
          strict: edge.strict,
        })),
        fill: Arr.map(geometry.fill, (shape) => Arr.map(shape, project)),
        kind: "region" as const,
      },
    ];
  }
  if (geometry.kind === "grid") {
    const points = Arr.map(geometry.grid.points, Option.map(project));
    return [
      {
        ...fields,
        ...frame,
        grid: { ...geometry.grid, points },
        kind: "surface" as const,
      },
    ];
  }
  return [
    {
      ...fields,
      faces: Arr.map(geometry.faces, (face) => Arr.map(face, project)),
      kind: "solid" as const,
    },
  ];
}

/**
 * Samples every formula object of a scene at the sliders' current values and
 * projects what it draws into scene units. A function samples each of its
 * labels' inputs exactly.
 */
export function resolveFormulaShapes(
  scene: PlaneVisual | SpaceVisual,
  projection: VisualProjection,
  scope: FormulaScope
) {
  const project = sampleProjector(projection);
  // A region or an implicit curve is traced over the reach, so it runs past every view. Marching squares
  // interpolate their crossings, so a straight edge stays exact and a curved one stays well under a pixel off.
  const { box } = resolveVisualReach(scene, projection);
  const reach = { x: box.x, y: box.y };
  const bounds = projectVisualFrame(scene, projection);
  const frame = {
    max: { x: bounds.x.max, y: bounds.y.max, z: bounds.z.max },
    min: { x: bounds.x.min, y: bounds.y.min, z: bounds.z.min },
  };
  const labels = scene.labels ?? [];
  const sampled =
    scene.space === "plane"
      ? Arr.map(Arr.filter(scene.objects, isPlaneFormula), (object) => {
          const axis =
            object.kind === "function" ? (object.inputAxis ?? "x") : "x";
          const named = Arr.flatMap(labels, ({ at, objectId }) =>
            objectId === object.id && !isPlaneFormulaPoint(at) ? [at[axis]] : []
          );
          return Result.map(
            planeFormulaGeometry(
              object,
              object.kind === "region" || object.kind === "implicit"
                ? reach
                : scene.frame,
              scope,
              named
            ),
            (geometry) => shapesOf(object, geometry, project, frame)
          );
        })
      : Arr.map(Arr.filter(scene.objects, isSpaceFormula), (object) =>
          Result.map(
            spaceFormulaGeometry(object, scene.frame, scope),
            (geometry) => shapesOf(object, geometry, project, frame)
          )
        );
  return Result.map(Result.all(sampled), Arr.flatten);
}

/**
 * Where one label stands at the sliders' current values: its exact point, or
 * the point its formulas place. A formula that is not finite there places
 * nothing, so the label hides until the sliders bring it back.
 */
export function labelPoint(
  at: NonNullable<PlaneVisual["labels"]>[number]["at"] | SpacePoint,
  scope: FormulaScope
) {
  if (!isPlaneFormulaPoint(at)) {
    return Option.some(at);
  }
  // The guard decodes each coordinate as formula text, which always compiles.
  return Option.flatten(Result.getSuccess(planeFormulaPoint(at, scope)));
}

/** The value of each readout at the sliders' current values, none where it is not finite. */
export function readoutValues(
  readouts: readonly FormulaReadout[],
  scope: FormulaScope
) {
  return Arr.map(readouts, ({ formula, key }) => ({
    key,
    value: Result.match(compileText(formula), {
      onFailure: () => Option.none<number>(),
      onSuccess: (evaluate) =>
        Option.filter(Option.some(evaluate(scope)), Number.isFinite),
    }),
  }));
}
