import { MathAppearanceSchema, SpacePointSchema } from "@nakafa/aksara-contracts/math/base";
import type { FormulaScope } from "@nakafa/aksara-contracts/math/formula/compile";
import {
  type FormulaGeometry,
  planeFormulaGeometry,
} from "@nakafa/aksara-contracts/math/formula/plane";
import { spaceFormulaGeometry } from "@nakafa/aksara-contracts/math/formula/space";
import { Array as Arr, Option, Result, Schema } from "effect";
import type {
  PlaneObject,
  PlaneVisual,
  SpaceObject,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectVisualFrame,
  sampleProjector,
  type VisualProjection,
} from "@/lib/content/renderer/client/base/visual/transform";

const PointsSchema = Schema.Array(SpacePointSchema);
const ShapeFields = { appearance: MathAppearanceSchema, id: Schema.String };

/** One drawable piece of a formula object, already in scene units. */
export const FormulaShapeSchema = Schema.Union([
  Schema.Struct({ ...ShapeFields, kind: Schema.Literal("curve"), points: PointsSchema }),
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
  Schema.Struct({ ...ShapeFields, faces: Schema.Array(PointsSchema), kind: Schema.Literal("solid") }),
]);
export type FormulaShape = typeof FormulaShapeSchema.Type;

type PlaneFormula = Extract<
  PlaneObject,
  { readonly kind: "function" | "implicit" | "parametric" | "polar" | "region" }
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
    object.kind === "parametric" ||
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
      id: geometry.branches.length === 1 ? object.id : `${object.id}:part:${index + 1}`,
      kind: "curve" as const,
      points: Arr.map(branch, project),
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
    return [{ ...fields, ...frame, grid: { ...geometry.grid, points }, kind: "surface" as const }];
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
  const bounds = projectVisualFrame(scene, projection);
  const frame = {
    max: { x: bounds.x.max, y: bounds.y.max, z: bounds.z.max },
    min: { x: bounds.x.min, y: bounds.y.min, z: bounds.z.min },
  };
  const labels = scene.labels ?? [];
  const sampled =
    scene.space === "plane"
      ? Arr.map(Arr.filter(scene.objects, isPlaneFormula), (object) => {
          const axis = object.kind === "function" ? (object.inputAxis ?? "x") : "x";
          const named = Arr.flatMap(labels, ({ at, objectId }) =>
            objectId === object.id ? [at[axis]] : []
          );
          return Result.map(
            planeFormulaGeometry(object, scene.frame, scope, named),
            (geometry) => shapesOf(object, geometry, project, frame)
          );
        })
      : Arr.map(Arr.filter(scene.objects, isSpaceFormula), (object) =>
          Result.map(spaceFormulaGeometry(object, scene.frame, scope), (geometry) =>
            shapesOf(object, geometry, project, frame)
          )
        );
  return Result.map(Result.all(sampled), Arr.flatten);
}
