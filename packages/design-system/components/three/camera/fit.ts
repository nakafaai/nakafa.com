import type { CameraSilhouette } from "@repo/design-system/components/three/camera/silhouette";
import {
  silhouetteBounds,
  silhouetteReach,
} from "@repo/design-system/components/three/camera/silhouette";
import type { CameraProjection } from "@repo/design-system/lib/geometry/camera";
import type { CameraPixelLabel } from "@repo/design-system/lib/geometry/camera/bounds";
import { Array as Arr, Match, Schema } from "effect";
import { Box3, MathUtils, Matrix4, Vector3 } from "three";

const DEFAULT_CAMERA_X = 12;
const DEFAULT_CAMERA_Y = 8;
const DEFAULT_CAMERA_Z = 12;
const DEFAULT_TARGET_X = 0;
const DEFAULT_TARGET_Y = 0;
const DEFAULT_TARGET_Z = 0;

/** Default camera position when a scene omits an explicit authored pose. */
export const DEFAULT_CAMERA_POSITION = [
  DEFAULT_CAMERA_X,
  DEFAULT_CAMERA_Y,
  DEFAULT_CAMERA_Z,
] satisfies readonly [number, number, number];

/** Default camera look-at target when a scene omits an explicit authored target. */
export const DEFAULT_CAMERA_TARGET = [
  DEFAULT_TARGET_X,
  DEFAULT_TARGET_Y,
  DEFAULT_TARGET_Z,
] satisfies readonly [number, number, number];

/**
 * Share of each frame side left free between the content and the frame edge.
 * The content therefore spans 94% of the side that binds, at every frame size.
 */
export const FRAME_EDGE_SHARE = 0.03;

/** Two limits whose rates sum to less than this can never meet in the frame. */
const MINIMUM_RATE = 1e-9;

/** Halvings that narrow a frame side onto the content, far under a pixel. */
const HUG_STEPS = 40;

/**
 * One frame edge's hold on the sideways camera offset: the offset stays at or
 * beyond `offset - rate * amount` for a low limit and at or under
 * `offset + rate * amount` for a high one, where the amount is the camera
 * distance (perspective) or the visible world height (orthographic).
 */
const EdgeLimitSchema = Schema.Struct({
  offset: Schema.Finite,
  rate: Schema.Finite,
});

const AxisLimitsSchema = Schema.Struct({
  high: Schema.Array(EdgeLimitSchema),
  low: Schema.Array(EdgeLimitSchema),
});

type AxisLimits = typeof AxisLimitsSchema.Type;

/** The points a fixed-pixel label hangs from, with and without its gap. */
function labelAnchors(label: CameraPixelLabel, right: Vector3, up: Vector3) {
  const { max, min } = label.anchors;
  const corners = Arr.flatMap(Arr.dedupe([min.x, max.x]), (x) =>
    Arr.flatMap(Arr.dedupe([min.y, max.y]), (y) =>
      Arr.map(Arr.dedupe([min.z, max.z]), (z) => new Vector3(x, y, z))
    )
  );
  if (label.gap.x === 0 && label.gap.y === 0) {
    return corners;
  }
  // Drei scales the gap by radial distance, so it lies between zero and its
  // full world displacement. Both ends bound it.
  return Arr.flatMap(corners, (corner) => [
    corner,
    corner
      .clone()
      .addScaledVector(right, label.gap.x)
      .addScaledVector(up, label.gap.y),
  ]);
}

/**
 * Fits finite content along the authored viewing direction, as tightly as the
 * frame allows. The camera moves; the content and its proportions stay as
 * authored.
 *
 * Every silhouette is held inside the four frame edges by its true projected
 * outline: a box by its faces, a ball by its tangent cone, a ring by its
 * ellipse. A label that keeps a fixed pixel size reserves exactly its own
 * rectangle beside its anchor and nothing else; when the labels cannot share
 * the frame with the content, the content alone is fitted.
 */
export function resolveContentFit({
  fov,
  height,
  labels,
  minimumViewHeight,
  position,
  projection,
  silhouettes,
  target,
  width,
}: {
  readonly fov: number;
  readonly height: number;
  readonly labels: readonly CameraPixelLabel[];
  readonly minimumViewHeight: number;
  readonly position: Vector3;
  readonly projection: CameraProjection["kind"];
  readonly silhouettes: readonly CameraSilhouette[];
  readonly target: Vector3;
  readonly width: number;
}) {
  const basis = new Matrix4().lookAt(position, target, new Vector3(0, 1, 0));
  const right = new Vector3().setFromMatrixColumn(basis, 0);
  const up = new Vector3().setFromMatrixColumn(basis, 1);
  const backward = new Vector3().setFromMatrixColumn(basis, 2);
  const bounds = new Box3();
  for (const silhouette of silhouettes) {
    bounds.union(silhouetteBounds(silhouette));
  }
  const center = bounds.getCenter(new Vector3());
  const radius = Math.max(bounds.getSize(new Vector3()).length() / 2, 0.01);
  const perspective = projection === "perspective";
  // The frame edges already keep the camera outside the content; this only
  // keeps it just clear of content without any width or height.
  const clear =
    Math.max(
      ...Arr.map(silhouettes, (silhouette) =>
        silhouetteReach(silhouette, backward, center)
      )
    ) +
    radius * 0.02;
  // World units per pixel at one unit of the amount.
  const pixel = perspective
    ? (2 * Math.tan(MathUtils.degToRad(fov) / 2)) / height
    : 1 / height;

  const limits = (
    axis: Vector3,
    room: number,
    labelled: readonly CameraPixelLabel[],
    rectangle: (label: CameraPixelLabel) => readonly [number, number]
  ): AxisLimits => {
    const edge = (sign: number, inset: number) => {
      const rate = (room - inset) * pixel;
      const direction = axis.clone().multiplyScalar(sign);
      return {
        direction: perspective
          ? direction.addScaledVector(backward, rate)
          : direction,
        rate,
      };
    };
    const plainHigh = edge(-1, 0);
    const plainLow = edge(1, 0);
    return {
      high: [
        ...Arr.map(silhouettes, (silhouette) => ({
          offset: -silhouetteReach(silhouette, plainHigh.direction, center),
          rate: plainHigh.rate,
        })),
        ...Arr.flatMap(labelled, (label) => {
          const { direction, rate } = edge(-1, -rectangle(label)[0]);
          return Arr.map(labelAnchors(label, right, up), (anchor) => ({
            offset: -anchor.sub(center).dot(direction),
            rate,
          }));
        }),
      ],
      low: [
        ...Arr.map(silhouettes, (silhouette) => ({
          offset: silhouetteReach(silhouette, plainLow.direction, center),
          rate: plainLow.rate,
        })),
        ...Arr.flatMap(labelled, (label) => {
          const { direction, rate } = edge(1, rectangle(label)[1]);
          return Arr.map(labelAnchors(label, right, up), (anchor) => ({
            offset: anchor.sub(center).dot(direction),
            rate,
          }));
        }),
      ],
    };
  };
  const frame = (labelled: readonly CameraPixelLabel[]) => {
    const horizontal = (room: number) =>
      limits(right, room, labelled, (label) => [
        label.rectangle.min.x,
        label.rectangle.max.x,
      ]);
    const vertical = (room: number) =>
      limits(up, room, labelled, (label) => [
        label.rectangle.min.y,
        label.rectangle.max.y,
      ]);
    const wide = (0.5 - FRAME_EDGE_SHARE) * width;
    const tall = (0.5 - FRAME_EDGE_SHARE) * height;
    const amount = Math.max(
      perspective ? clear : Math.max(radius * 0.02, minimumViewHeight),
      smallestAmount(horizontal(wide)),
      smallestAmount(vertical(tall))
    );
    return {
      amount,
      x: () => centredOffset(horizontal, wide, amount),
      y: () => centredOffset(vertical, tall, amount),
    };
  };

  const labelledFrame = frame(labels);
  const fitted = Number.isFinite(labelledFrame.amount)
    ? labelledFrame
    : frame([]);
  const fittedTarget = center
    .clone()
    .addScaledVector(right, fitted.x())
    .addScaledVector(up, fitted.y());
  // An orthographic camera only has to stand outside the content.
  const distance = perspective ? fitted.amount : 2 * radius;

  return {
    bounds,
    distance,
    far: (distance + radius) * 4,
    // A near plane this far out keeps the depth buffer fine enough for the
    // layered ground, which shows hairline seams with a nearer one.
    near: radius / 100,
    position: fittedTarget.clone().addScaledVector(backward, distance),
    radius,
    target: fittedTarget,
    viewHeight: perspective
      ? 2 * fitted.amount * Math.tan(MathUtils.degToRad(fov) / 2)
      : fitted.amount,
  };
}

/**
 * The smallest amount at which every low limit sits at or under every high
 * one, or infinity when two limits can never share the frame.
 */
function smallestAmount({ high, low }: AxisLimits) {
  let amount = Number.NEGATIVE_INFINITY;
  for (const lower of low) {
    for (const upper of high) {
      const rate = lower.rate + upper.rate;
      if (rate < MINIMUM_RATE) {
        return Number.POSITIVE_INFINITY;
      }
      amount = Math.max(amount, (lower.offset - upper.offset) / rate);
    }
  }
  return amount;
}

/**
 * The sideways offset that centres the content on the screen. On the side that
 * binds, the frame already pins it. On the other side the frame is narrowed
 * about its middle until it hugs the content at the fitted amount, which
 * leaves the same number of pixels free on both sides at any depth.
 */
function centredOffset(
  limitsAt: (room: number) => AxisLimits,
  room: number,
  amount: number
) {
  let tight = 0;
  let loose = room;
  for (let step = 0; step < HUG_STEPS; step += 1) {
    const middle = (tight + loose) / 2;
    if (smallestAmount(limitsAt(middle)) > amount) {
      tight = middle;
    } else {
      loose = middle;
    }
  }
  const { high, low } = limitsAt(loose);
  let lowest = Number.NEGATIVE_INFINITY;
  let highest = Number.POSITIVE_INFINITY;
  for (const limit of low) {
    lowest = Math.max(lowest, limit.offset - limit.rate * amount);
  }
  for (const limit of high) {
    highest = Math.min(highest, limit.offset + limit.rate * amount);
  }
  return (lowest + highest) / 2;
}

/**
 * Keeps panning on the fitted content without changing the orbit. Writes the
 * correction into `offset`, so a drag allocates nothing per frame.
 */
export function resolvePanOffset(
  bounds: Box3,
  target: Vector3,
  offset: Vector3
) {
  return offset.copy(target).clamp(bounds.min, bounds.max).sub(target);
}

/**
 * Serializes every measurement and projection input that invalidates a content
 * camera fit so unchanged redraws keep the user's current camera pose.
 */
export function cameraFitKey(input: {
  readonly authoredPosition: Vector3;
  readonly authoredTarget: Vector3;
  readonly labels: readonly CameraPixelLabel[];
  readonly maxDistance: number | undefined;
  readonly minDistance: number | undefined;
  readonly projectionFar: number | undefined;
  readonly projectionFov: number;
  readonly projectionHeight: number;
  readonly projectionNear: number | undefined;
  readonly silhouettes: readonly CameraSilhouette[];
  readonly viewportHeight: number;
  readonly viewportWidth: number;
}): string {
  // Each part is written the way join writes it: undefined becomes an empty string.
  return Arr.join(
    Arr.map(
      [
        ...Arr.flatMap(input.silhouettes, (silhouette) =>
          Match.value(silhouette).pipe(
            Match.discriminatorsExhaustive("kind")({
              box: ({ box, kind }) => [
                kind,
                ...box.min.toArray(),
                ...box.max.toArray(),
              ],
              ring: ({ center, kind, normal, radius }) => [
                kind,
                ...center.toArray(),
                ...normal.toArray(),
                radius,
              ],
              sphere: ({ center, kind, radius }) => [
                kind,
                ...center.toArray(),
                radius,
              ],
            })
          )
        ),
        ...Arr.flatMap(input.labels, (label) => [
          ...label.anchors.min.toArray(),
          ...label.anchors.max.toArray(),
          label.gap.x,
          label.gap.y,
          ...label.rectangle.min.toArray(),
          ...label.rectangle.max.toArray(),
        ]),
        ...input.authoredPosition.toArray(),
        ...input.authoredTarget.toArray(),
        input.viewportWidth,
        input.viewportHeight,
        input.projectionFov,
        input.projectionHeight,
        input.projectionNear,
        input.projectionFar,
        input.minDistance,
        input.maxDistance,
      ],
      (part) => String(part ?? "")
    ),
    ","
  );
}
