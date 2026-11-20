import { useFrame, useThree } from "@react-three/fiber";
import { clipAxis } from "@repo/design-system/components/three/axes";
import { createAxisGeometry } from "@repo/design-system/components/three/frame";
import { SceneHtml } from "@repo/design-system/components/three/overlay";
import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { gridSteps, stepValues } from "@repo/design-system/lib/geometry/step";
import { AXIS_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema, Struct } from "effect";
import { useCallback, useMemo, useRef } from "react";
import type { Camera } from "three";
import { Frustum, Matrix4, OrthographicCamera, Vector3 } from "three";
import { useFormatter } from "use-intl";

/** The most numbers one axis shows at once; a major step leaves at most about ten across the view. */
const POOL = 16;

/** Space, in pixels, between a number and its axis, and between a number and the canvas's edge. */
const GAP = 4;

/** The height of one number, in pixels, for keeping it inside the canvas. */
const LINE = 12;

/** The width of one character of a number, in pixels, for keeping it inside the canvas. */
const CHARACTER = 7;

type Axis = "x" | "y" | "z";

const AXES: readonly Axis[] = ["x", "y", "z"];

/** A number's element, once React attaches it; the check never runs on the server. */
const SpanSchema = Schema.declare(
  (input: unknown): input is HTMLSpanElement =>
    typeof HTMLSpanElement !== "undefined" && input instanceof HTMLSpanElement
);

/** One number of the pool: its element, and what the frame last wrote to it. */
const SlotSchema = Schema.Struct({
  element: Schema.NullOr(SpanSchema),
  text: Schema.String,
  transform: Schema.String,
  visible: Schema.Boolean,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
type Slot = typeof SlotSchema.Type;

/** Writes one number only where it changed, so a still camera writes nothing. */
function write(slot: Slot, text: string, transform: string) {
  const { element } = slot;
  if (!element) {
    return;
  }
  if (slot.text !== text) {
    element.textContent = text;
    slot.text = text;
  }
  if (slot.transform !== transform) {
    element.style.transform = transform;
    slot.transform = transform;
  }
  if (!slot.visible) {
    element.style.visibility = "visible";
    slot.visible = true;
  }
}

/** Hides every number of a pool from `from` on. */
function hideFrom(slots: readonly Slot[], from: number) {
  for (const slot of Arr.drop(slots, from)) {
    if (slot.visible && slot.element) {
      slot.element.style.visibility = "hidden";
      slot.visible = false;
    }
  }
}

/** Whether the camera looks straight down the z axis, as a flat scene's first view does. */
function isFrontal(
  camera: Camera,
  scratch: Vector3
): camera is OrthographicCamera {
  return (
    camera instanceof OrthographicCamera &&
    camera.getWorldDirection(scratch).z < -0.999
  );
}

/**
 * The numbers of an unbounded world's axes, at the major lines of its grid
 * (`gridSteps`), so the numbers and the grid agree at every zoom. In a flat
 * scene seen head on, the numbers of an axis that leaves the view stick to the
 * nearest edge of the canvas, the way a graphing tool keeps its scale in view
 * after a pan or for a frame far from zero. Seen at an angle, as every space
 * scene is, each axis carries its own numbers along it.
 *
 * The numbers are a fixed pool of elements written in the frame loop, like the
 * axis names: no React state and no allocation while the camera moves, and
 * nothing written while it stands still.
 */
export function AxisTicks({
  origin = { x: 0, y: 0, z: 0 },
  reach,
  scale,
  showZAxis,
}: {
  readonly origin?: Point3 | undefined;
  /** Half-width, in world units, of the box around the world's center that the camera can show. */
  readonly reach: number;
  /** World units that one mathematical unit takes on each axis. */
  readonly scale: Point3;
  readonly showZAxis: boolean;
}) {
  const format = useFormatter();
  const invalidate = useThree((state) => state.invalidate);
  const pools = useMemo(
    () =>
      Arr.map(AXES, () =>
        Arr.makeBy(
          POOL,
          (): Slot => ({
            element: null,
            text: "",
            transform: "",
            visible: false,
          })
        )
      ),
    []
  );
  const axes = useMemo(() => {
    const geometry = createAxisGeometry(reach, origin);
    return Arr.map(AXES, (axis) => ({
      ...geometry[axis],
      from: new Vector3(
        geometry[axis].from.x,
        geometry[axis].from.y,
        geometry[axis].from.z
      ),
      to: new Vector3(
        geometry[axis].to.x,
        geometry[axis].to.y,
        geometry[axis].to.z
      ),
    }));
  }, [origin, reach]);
  const scratch = useRef({
    direction: new Vector3(),
    frustum: new Frustum(),
    point: new Vector3(),
    projection: new Matrix4(),
  }).current;
  const attach = useCallback(
    (axis: number, index: number) => (element: HTMLSpanElement | null) => {
      const slot = pools[axis]?.[index];
      if (slot) {
        // A new element's state is unknown: the next frame writes or hides it.
        slot.element = element;
        slot.visible = element !== null;
        slot.text = "";
        slot.transform = "";
      }
      if (element) {
        invalidate();
      }
    },
    [invalidate, pools]
  );

  // OrbitControls runs at -1 and the overlay places its root at 0: write the
  // numbers between them, from the camera of the frame being drawn.
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    if (isFrontal(camera, scratch.direction)) {
      const ortho = camera;
      const width = (ortho.right - ortho.left) / ortho.zoom;
      const height = (ortho.top - ortho.bottom) / ortho.zoom;
      const left = camera.position.x + ortho.left / ortho.zoom;
      const top = camera.position.y + ortho.top / ortho.zoom;
      const short = Math.min(width, height);
      const toX = (world: number) => ((world - left) / width) * size.width;
      const toY = (world: number) => ((top - world) / height) * size.height;
      for (const [index, axis] of [
        [0, "x"],
        [1, "y"],
      ] as const) {
        const slots = pools[index] ?? [];
        const steps = gridSteps(short / scale[axis]);
        const low =
          axis === "x"
            ? (left - origin.x) / scale.x
            : (top - height - origin.y) / scale.y;
        const high = low + (axis === "x" ? width / scale.x : height / scale.y);
        const values = stepValues({ max: high, min: low }, steps.major, POOL);
        // The other axis's line, where the numbers stand unless it has left the view.
        const across = axis === "x" ? toY(origin.y) : toX(origin.x);
        Arr.forEach(values, (value, slot) => {
          const text = format.number(value, "axis", {
            maximumFractionDigits: steps.digits,
          });
          const along =
            axis === "x"
              ? toX(origin.x + value * scale.x)
              : toY(origin.y + value * scale.y);
          let transform: string;
          if (axis === "x") {
            const y = Math.min(
              size.height - GAP - LINE,
              Math.max(GAP, across + GAP)
            );
            transform = `translate(calc(${along}px - 50%), ${y}px)`;
          } else {
            const wide = text.length * CHARACTER;
            const x = Math.min(
              size.width - GAP,
              Math.max(GAP + wide, across - GAP)
            );
            transform = `translate(calc(${x}px - 100%), ${along - LINE / 2}px)`;
          }
          const target = slots[slot];
          if (target) {
            write(target, text, transform);
          }
        });
        hideFrom(slots, values.length);
      }
      hideFrom(pools[2] ?? [], 0);
      return;
    }
    // Seen at an angle: each axis carries its numbers along its visible part.
    scratch.projection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    scratch.frustum.setFromProjectionMatrix(scratch.projection);
    Arr.forEach(axes, (line, index) => {
      const axis = AXES[index] ?? "x";
      const slots = pools[index] ?? [];
      const interval =
        line.visible && (axis !== "z" || showZAxis)
          ? clipAxis(scratch.frustum, line.from, line.to)
          : undefined;
      if (!interval) {
        hideFrom(slots, 0);
        return;
      }
      const at = (fraction: number) =>
        (line.from[axis] +
          (line.to[axis] - line.from[axis]) * fraction -
          origin[axis]) /
        scale[axis];
      const low = at(interval.minimum);
      const high = at(interval.maximum);
      // The axis's own length on screen sets its step, as the view's side does for a flat scene.
      scratch.point.lerpVectors(line.from, line.to, interval.minimum);
      scratch.point.project(camera);
      const startX = scratch.point.x;
      const startY = scratch.point.y;
      scratch.point.lerpVectors(line.from, line.to, interval.maximum);
      scratch.point.project(camera);
      const pixels = Math.hypot(
        ((scratch.point.x - startX) * size.width) / 2,
        ((scratch.point.y - startY) * size.height) / 2
      );
      const span =
        pixels > 1
          ? ((high - low) * Math.min(size.width, size.height)) / pixels
          : Number.NaN;
      const steps = gridSteps(span);
      const values = Number.isFinite(span)
        ? stepValues({ max: high, min: low }, steps.major, POOL)
        : [];
      Arr.forEach(values, (value, slot) => {
        scratch.point
          .copy(line.from)
          .setComponent(index, origin[axis] + value * scale[axis]);
        scratch.point.project(camera);
        const x = ((scratch.point.x + 1) / 2) * size.width;
        const y = ((1 - scratch.point.y) / 2) * size.height;
        const target = slots[slot];
        if (target) {
          write(
            target,
            format.number(value, "axis", {
              maximumFractionDigits: steps.digits,
            }),
            `translate(calc(${x}px - 50%), ${y + GAP}px)`
          );
        }
      });
      hideFrom(slots, values.length);
    });
  }, -0.5);

  return (
    <SceneHtml calculatePosition={() => [0, 0]}>
      <div aria-hidden="true" data-slot="axis-ticks">
        {Arr.map(AXES, (axis, index) =>
          Arr.makeBy(POOL, (slot) => (
            <span
              data-axis-tick={axis}
              key={`${axis}:${slot}`}
              ref={attach(index, slot)}
              style={{
                color: AXIS_COLORS[axis],
                fontSize: 12,
                fontVariantNumeric: "tabular-nums",
                left: 0,
                lineHeight: 1,
                pointerEvents: "none",
                position: "absolute",
                top: 0,
                userSelect: "none",
                visibility: "hidden",
                whiteSpace: "nowrap",
              }}
            />
          ))
        )}
      </div>
    </SceneHtml>
  );
}
