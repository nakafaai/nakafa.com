import { MathAppearanceSchema } from "@nakafa/aksara-contracts/math/base";
import type { FormulaScope } from "@nakafa/aksara-contracts/math/formula/compile";
import { Array as Arr, Option, Result, Schema } from "effect";
import { resolveVisualAxes } from "@/lib/content/renderer/client/base/visual/axes";
import {
  type FormulaShape,
  labelPoint,
  resolveFormulaShapes,
} from "@/lib/content/renderer/client/base/visual/formula";
import { resolveVisualGeometry } from "@/lib/content/renderer/client/base/visual/geometry";
import type {
  PlaneObject,
  PlaneVisual,
  SpaceObject,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  LinePointSchema,
  THIN_TOLERANCE,
  thinLine,
} from "@/lib/content/renderer/client/base/visual/thin";
import {
  projectVisualPoint,
  type VisualProjection,
} from "@/lib/content/renderer/client/base/visual/transform";
import { resolveMathView } from "@/lib/content/renderer/client/base/visual/view";

/** One point of the still, right and up from the camera's target, in scene units. */
type StillPoint = typeof LinePointSchema.Type;

/** How far the drawing reaches past its outermost point, as a share of its larger side. */
const MARGIN = 0.06;

/** About how many lines each way a surface's wireframe draws. */
const WIRES = 10;

/** A three-dimensional direction as one tuple. */
const VectorSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
type Vector = typeof VectorSchema.Type;

function subtract(a: Vector, b: Vector): Vector {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vector, b: Vector): Vector {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: Vector, b: Vector) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function unit(a: Vector): Vector {
  const length = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / length, a[1] / length, a[2] / length];
}

/**
 * The camera's own flat view of the scene: a point lands right and up from the target, as the camera sees it along
 * its line of sight. A perspective camera is drawn without its perspective, which keeps every object where it stands.
 */
function cameraPlane(position: Vector, target: Vector) {
  const forward = unit(subtract(target, position));
  // Up is the scene's y, or its z for a camera that looks straight down y.
  const upward: Vector =
    Math.abs(forward[1]) > 0.999 ? [0, 0, forward[1] > 0 ? 1 : -1] : [0, 1, 0];
  const right = unit(cross(forward, upward));
  const up = cross(right, forward);
  return ({ x, y, z }: SpacePoint): StillPoint => {
    const offset = subtract([x, y, z], target);
    // Three decimals of a scene unit is far finer than a pixel, and keeps the page's HTML small.
    return [round(dot(offset, right)), round(dot(offset, up))];
  };
}

/** One line or area of the still, in its appearance's color. */
const StillStrokeSchema = Schema.Struct({
  appearance: MathAppearanceSchema,
  closed: Schema.Boolean,
  filled: Schema.Boolean,
  id: Schema.String,
  points: Schema.Array(LinePointSchema),
});
type StillStroke = typeof StillStrokeSchema.Type;

/** The shading of one region, as the rings of one unstroked path that its stroked edges outline. */
const StillAreaSchema = Schema.Struct({
  appearance: MathAppearanceSchema,
  id: Schema.String,
  rings: Schema.Array(Schema.Array(LinePointSchema)),
});
type StillArea = typeof StillAreaSchema.Type;

/** A label of either scene dimension, so one list can hold both. */
type StillLabel =
  | NonNullable<PlaneVisual["labels"]>[number]
  | NonNullable<SpaceVisual["labels"]>[number];

/** The strokes and dots that one formula shape draws. */
function formulaStrokes(
  shape: FormulaShape,
  flat: (point: SpacePoint) => StillPoint
): readonly StillStroke[] {
  const stroke = (
    id: string,
    points: readonly SpacePoint[],
    closed: boolean,
    filled: boolean
  ): StillStroke => ({
    appearance: shape.appearance,
    closed,
    filled,
    id,
    points: Arr.map(points, flat),
  });
  if (shape.kind === "curve") {
    return [stroke(shape.id, shape.points, false, false)];
  }
  if (shape.kind === "marker") {
    return [];
  }
  if (shape.kind === "region") {
    return Arr.map(shape.boundary, ({ points }, index) =>
      stroke(`${shape.id}:edge:${index}`, points, false, false)
    );
  }
  if (shape.kind === "surface") {
    const { columns, points, rows } = shape.grid;
    const at = (row: number, column: number) =>
      Option.flatten(Arr.get(points, row * columns + column));
    // A wireframe of about `WIRES` lines each way reads as the surface; every sampled row would fill it solid.
    const every = (count: number) =>
      Arr.filter(
        Arr.range(0, count - 1),
        (index) => index % Math.ceil(count / WIRES) === 0 || index === count - 1
      );
    return [
      ...Arr.map(every(rows), (row) =>
        stroke(
          `${shape.id}:row:${row}`,
          Arr.getSomes(
            Arr.map(Arr.range(0, columns - 1), (column) => at(row, column))
          ),
          false,
          false
        )
      ),
      ...Arr.map(every(columns), (column) =>
        stroke(
          `${shape.id}:column:${column}`,
          Arr.getSomes(
            Arr.map(Arr.range(0, rows - 1), (row) => at(row, column))
          ),
          false,
          false
        )
      ),
    ];
  }
  return Arr.map(shape.faces, (points, index) =>
    stroke(`${shape.id}:face:${index}`, points, true, true)
  );
}

/**
 * Draws a scene flat, as its camera first sees it, for the still that stands in the card until the reader's intent
 * loads the scene: the axes with the real values of an axis whose range leaves zero out (`ticks`), every object and
 * formula at the sliders' values, and where each label stands. The still reads the same geometry and axes the scene
 * does (`resolveVisualAxes`), so it shows the same picture, framed by the scene's own frame, and never a blank or
 * invented one.
 */
export function drawStill(
  scene: PlaneVisual | SpaceVisual,
  projection: VisualProjection,
  scope: FormulaScope
) {
  const view = resolveMathView(scene, projection);
  const flat = cameraPlane(view.position, view.target);
  const geometry = resolveVisualGeometry(scene, projection);
  const { lines, values } = resolveVisualAxes(scene, projection);
  const axes = Arr.map(lines, ({ axis, from, to }) => ({
    axis,
    points: [flat(from), flat(to)],
  }));
  const ticks = Arr.map(values, ({ at, axis, end, value }) => ({
    at: flat(at),
    axis,
    key: `${axis}:${end}`,
    value,
  }));
  const shapes = Result.getOrElse(
    resolveFormulaShapes(scene, projection, scope),
    () => []
  );
  const strokes: readonly StillStroke[] = [
    ...Arr.map(geometry.regions, (region) => ({
      appearance: region.appearance,
      closed: true,
      filled: true,
      id: region.id,
      points: Arr.map(region.vertices, flat),
    })),
    ...Arr.map(geometry.paths, (path) => ({
      appearance: path.appearance,
      closed: false,
      filled: false,
      id: path.id,
      points: Arr.map(path.points, flat),
    })),
    ...Arr.flatMap(shapes, (shape) => formulaStrokes(shape, flat)),
  ];
  const areas: readonly StillArea[] = Arr.flatMap(shapes, (shape) =>
    shape.kind === "region"
      ? [
          {
            appearance: shape.appearance,
            id: shape.id,
            rings: Arr.map(shape.fill, (points) => Arr.map(points, flat)),
          },
        ]
      : []
  );
  const dots = [
    ...Arr.map(geometry.markers, (marker) => ({
      appearance: marker.appearance,
      at: flat(marker.at),
      id: marker.id,
    })),
    ...Arr.flatMap(shapes, (shape) =>
      shape.kind === "marker"
        ? [
            {
              appearance: shape.appearance,
              at: flat(shape.point),
              id: shape.id,
            },
          ]
        : []
    ),
  ];
  // Schema validation guarantees that each label has exactly one object owner, whose color it takes.
  const objects: readonly (PlaneObject | SpaceObject)[] = scene.objects;
  const sceneLabels: readonly StillLabel[] = scene.labels ?? [];
  const labels = Arr.flatMap(objects, (object) =>
    Arr.flatMap(sceneLabels, (label) =>
      label.objectId === object.id
        ? Option.toArray(
            Option.map(labelPoint(label.at, scope), (point) => ({
              appearance: object.appearance,
              at: flat(projectVisualPoint(point, projection)),
              key: label.key,
              placement: label.placement ?? "center",
            }))
          )
        : []
    )
  );
  const all = [
    ...Arr.flatMap(axes, ({ points }) => points),
    ...Arr.flatMap(areas, ({ rings }) => Arr.flatten(rings)),
    ...Arr.flatMap(strokes, (stroke) => stroke.points),
    ...Arr.map(dots, (dot) => dot.at),
    ...Arr.map(labels, (label) => label.at),
  ];
  const xs = Arr.map(all, (point) => point[0]);
  const ys = Arr.map(all, (point) => point[1]);
  const left = Math.min(...xs);
  const bottom = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - bottom;
  const margin = Math.max(width, height) * MARGIN;
  // The still is drawn once at the card's size: a point nearer the line than a thousandth of the still adds bytes,
  // never shape, and a sampled curve or a region's edge is mostly such points.
  const tolerance = Math.max(width, height) * THIN_TOLERANCE;
  return {
    areas,
    axes,
    dots,
    labels,
    strokes: Arr.map(strokes, (stroke) => ({
      ...stroke,
      points: thinLine(stroke.points, tolerance),
    })),
    ticks,
    view: {
      height: height + margin * 2,
      left: left - margin,
      top: bottom - margin,
      width: width + margin * 2,
    },
  };
}
