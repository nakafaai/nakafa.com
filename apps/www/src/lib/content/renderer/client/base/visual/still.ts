import { MathAppearanceSchema } from "@nakafa/aksara-contracts/math/base";
import type { FormulaScope } from "@nakafa/aksara-contracts/math/formula/compile";
import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { createAxisGeometry } from "@repo/design-system/components/three/frame";
import { gridSteps, stepValues } from "@repo/design-system/lib/geometry/step";
import { Array as Arr, Option, Result, Schema } from "effect";
import type { FormulaShape } from "@/lib/content/renderer/client/base/visual/formula";
import {
  labelPoint,
  resolveFormulaShapes,
} from "@/lib/content/renderer/client/base/visual/formula";
import { resolveVisualGeometry } from "@/lib/content/renderer/client/base/visual/geometry";
import { resolveVisualReach } from "@/lib/content/renderer/client/base/visual/reach";
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
import type { VisualProjection } from "@/lib/content/renderer/client/base/visual/transform";
import { projectVisualPoint } from "@/lib/content/renderer/client/base/visual/transform";
import { resolveMathView } from "@/lib/content/renderer/client/base/visual/view";

/** One point of the still, right and up from the camera's target, in scene units. */
type StillPoint = typeof LinePointSchema.Type;

/** How far the drawing reaches past its outermost point, as a share of its larger side. */
const MARGIN = 0.06;

/** About how many lines each way a surface's wireframe draws. */
const WIRES = 10;

/**
 * How far past the drawing's middle the still numbers its axes, as a share of
 * its larger side: the card's wide aspect (1.43) shows that much on a side of
 * a square drawing, and the frame crops the rest.
 */
const NUMBERED = 0.715;

/** The most numbers one axis of the still shows. */
const NUMBERS = 16;

/** How far a camera's flat view may turn the axes and still count as seen head on. */
const HEAD_ON = 1e-6;

/** The grid of a still seen head on: the origin, and the minor and major steps of each axis, in scene units. */
const StillGridSchema = Schema.Struct({
  major: Schema.Tuple([Schema.Finite, Schema.Finite]),
  minor: Schema.Tuple([Schema.Finite, Schema.Finite]),
  origin: LinePointSchema,
});
type StillGrid = typeof StillGridSchema.Type;

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

/**
 * One line or area of the still, in its appearance's color. A dashed stroke is
 * a region's strict edge, which the scene dashes too.
 */
const StillStrokeSchema = Schema.Struct({
  appearance: MathAppearanceSchema,
  closed: Schema.Boolean,
  dashed: Schema.Boolean,
  filled: Schema.Boolean,
  id: Schema.String,
  points: Schema.Array(LinePointSchema),
  /** A line, a ray, a region's edge or an implicit curve that runs to the reach, which the still's view leaves out. */
  unbounded: Schema.Boolean,
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
    { closed = false, dashed = false, filled = false, unbounded = false } = {}
  ): StillStroke => ({
    appearance: shape.appearance,
    closed,
    dashed,
    filled,
    id,
    points: Arr.map(points, flat),
    unbounded,
  });
  if (shape.kind === "curve") {
    return [stroke(shape.id, shape.points, { unbounded: shape.unbounded })];
  }
  if (shape.kind === "marker") {
    return [];
  }
  if (shape.kind === "region") {
    return Arr.map(shape.boundary, ({ points, strict }, index) =>
      stroke(`${shape.id}:edge:${index}`, points, {
        dashed: strict,
        unbounded: true,
      })
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
          )
        )
      ),
      ...Arr.map(every(columns), (column) =>
        stroke(
          `${shape.id}:column:${column}`,
          Arr.getSomes(
            Arr.map(Arr.range(0, rows - 1), (row) => at(row, column))
          )
        )
      ),
    ];
  }
  return Arr.map(shape.faces, (points, index) =>
    stroke(`${shape.id}:face:${index}`, points, { closed: true, filled: true })
  );
}

/** The corners of a box: the eight of a space scene's, or the four of a plane scene's at its one depth. */
function corners(box: CoordinateFrame): readonly SpacePoint[] {
  return Arr.flatMap([box.x.min, box.x.max], (x) =>
    Arr.flatMap([box.y.min, box.y.max], (y) =>
      Arr.map(Arr.dedupe([box.z.min, box.z.max]), (z) => ({ x, y, z }))
    )
  );
}

/**
 * The grid and the axis numbers of a plane scene seen head on, from the same `gridSteps` the scene's grid and ticks
 * use over the drawing's shorter side, so the still and the loaded scene agree. The numbers run past the drawing as
 * far as the card's wide aspect shows; the card crops the rest. A space scene, or a plane scene seen at an angle, has
 * neither: its scene numbers each axis along it once it loads.
 */
function numberAxes(
  scene: PlaneVisual | SpaceVisual,
  flat: (point: SpacePoint) => StillPoint,
  world: ReturnType<typeof resolveVisualReach>,
  drawing: {
    readonly height: number;
    readonly left: number;
    readonly top: number;
    readonly width: number;
  }
) {
  const [zeroX, zeroY] = flat({ x: 0, y: 0, z: 0 });
  const [rightX, rightY] = flat({ x: 1, y: 0, z: 0 });
  const [upX, upY] = flat({ x: 0, y: 1, z: 0 });
  const headOn =
    scene.space === "plane" &&
    Math.abs(rightX - zeroX - 1) < HEAD_ON &&
    Math.abs(rightY - zeroY) < HEAD_ON &&
    Math.abs(upX - zeroX) < HEAD_ON &&
    Math.abs(upY - zeroY - 1) < HEAD_ON;
  if (!headOn) {
    return { grid: Option.none<StillGrid>(), ticks: [] };
  }
  const origin = flat(world.origin);
  const short = Math.min(drawing.width, drawing.height);
  const reach = Math.max(drawing.width, drawing.height) * NUMBERED;
  const middle = [
    drawing.left + drawing.width / 2,
    drawing.top + drawing.height / 2,
  ] as const;
  const steps = {
    x: gridSteps(short / world.scale.x),
    y: gridSteps(short / world.scale.y),
  };
  const ticks = Arr.flatMap(["x", "y"] as const, (axis) => {
    const index = axis === "x" ? 0 : 1;
    const values = stepValues(
      {
        max: (middle[index] + reach - origin[index]) / world.scale[axis],
        min: (middle[index] - reach - origin[index]) / world.scale[axis],
      },
      steps[axis].major,
      NUMBERS
    );
    return Arr.map(values, (value) => {
      const along = origin[index] + value * world.scale[axis];
      const at: StillPoint =
        axis === "x" ? [along, origin[1]] : [origin[0], along];
      return {
        at,
        axis,
        digits: steps[axis].digits,
        key: `${axis}:${value}`,
        value,
      };
    });
  });
  return {
    grid: Option.some<StillGrid>({
      major: [steps.x.major * world.scale.x, steps.y.major * world.scale.y],
      minor: [steps.x.minor * world.scale.x, steps.y.minor * world.scale.y],
      origin,
    }),
    ticks,
  };
}

/**
 * Draws a scene flat, as its camera first sees it, for the still that stands in the card until the reader's intent
 * loads the scene. It shows the scene's unbounded world: the axes through the true origin in their colors, every
 * object and formula at the sliders' values, lines, rays, regions and implicit curves running past the drawing (the
 * frame crops them), and where each label stands. The drawing frames what the camera fits first, the padded frame
 * and every finite object and label, never the length of an unbounded one. A plane scene seen head on also gets the
 * grid's steps (`grid`) and the axis numbers at its major lines (`ticks`), from the same `gridSteps` as the scene.
 */
export function drawStill(
  scene: PlaneVisual | SpaceVisual,
  projection: VisualProjection,
  scope: FormulaScope
) {
  const view = resolveMathView(scene, projection);
  const flat = cameraPlane(view.position, view.target);
  const geometry = resolveVisualGeometry(scene, projection);
  const world = resolveVisualReach(scene, projection);
  const lines = createAxisGeometry(world.radius, world.origin);
  const axes = Arr.flatMap(
    scene.space === "plane"
      ? (["x", "y"] as const)
      : (["x", "y", "z"] as const),
    (axis) =>
      lines[axis].visible
        ? [{ axis, points: [flat(lines[axis].from), flat(lines[axis].to)] }]
        : []
  );
  const shapes = Result.getOrElse(
    resolveFormulaShapes(scene, projection, scope),
    () => []
  );
  const strokes: readonly StillStroke[] = [
    ...Arr.map(geometry.regions, (region) => ({
      appearance: region.appearance,
      closed: true,
      dashed: false,
      filled: true,
      id: region.id,
      points: Arr.map(region.vertices, flat),
      unbounded: false,
    })),
    ...Arr.map(geometry.paths, (path) => ({
      appearance: path.appearance,
      closed: false,
      dashed: false,
      filled: false,
      id: path.id,
      points: Arr.map(path.points, flat),
      unbounded: path.unbounded,
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
  // The drawing frames what the camera fits first: the padded frame and every finite object and label.
  const all = [
    ...Arr.map(corners(world.focus), flat),
    ...Arr.flatMap(strokes, (stroke) =>
      stroke.unbounded ? [] : stroke.points
    ),
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
  const drawing = {
    height: height + margin * 2,
    left: left - margin,
    top: bottom - margin,
    width: width + margin * 2,
  };
  const numbered = numberAxes(scene, flat, world, drawing);
  return {
    areas,
    axes,
    dots,
    grid: numbered.grid,
    labels,
    strokes: Arr.map(strokes, (stroke) => ({
      ...stroke,
      points: thinLine(stroke.points, tolerance),
    })),
    ticks: numbered.ticks,
    view: drawing,
  };
}
