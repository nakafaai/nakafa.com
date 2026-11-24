import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { DrawnInlineMath } from "@repo/design-system/components/markdown/drawn";
import { createAxisGeometry } from "@repo/design-system/components/three/frame";
import type { AxisName } from "@repo/design-system/components/three/names";
import { AXIS_NAMES } from "@repo/design-system/components/three/names";
import { SceneHtml } from "@repo/design-system/components/three/overlay";
import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { AXIS_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useCallback, useMemo, useRef } from "react";
import type { Group } from "three";
import { Frustum, Matrix4, Vector2, Vector3 } from "three";

const LABEL_EDGE_SPACE = 4;
const LABEL_GAP = 12;
const LABEL_SIDES = [1, -1] as const;

function showAxisLabel(
  element: HTMLDivElement,
  scratch: { lastTransform: string; lastVisible: boolean },
  offsetX: number,
  offsetY: number
) {
  if (!scratch.lastVisible) {
    element.style.visibility = "visible";
    scratch.lastVisible = true;
  }
  const nextTransform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
  if (scratch.lastTransform !== nextTransform) {
    element.style.transform = nextTransform;
    scratch.lastTransform = nextTransform;
  }
}

function hideAxisLabel(
  element: HTMLDivElement,
  scratch: { lastVisible: boolean }
) {
  if (scratch.lastVisible) {
    element.style.visibility = "hidden";
    scratch.lastVisible = false;
  }
}

function updateAxisCameraCache(
  scratch: {
    height: number;
    lastProjection: Matrix4;
    lastWorld: Matrix4;
    lastZoom: number;
    width: number;
  },
  camera: { matrixWorld: Matrix4; projectionMatrix: Matrix4; zoom?: number },
  size: { height: number; width: number }
): boolean {
  const zoom = camera.zoom ?? 1;
  if (
    scratch.lastWorld.equals(camera.matrixWorld) &&
    scratch.lastProjection.equals(camera.projectionMatrix) &&
    scratch.lastZoom === zoom &&
    scratch.width === size.width &&
    scratch.height === size.height
  ) {
    return false;
  }
  scratch.lastWorld.copy(camera.matrixWorld);
  scratch.lastProjection.copy(camera.projectionMatrix);
  scratch.lastZoom = zoom;
  scratch.width = size.width;
  scratch.height = size.height;
  return true;
}

/** Intersects an axis segment with the six planes of the camera frustum. */
export function clipAxis(frustum: Frustum, from: Vector3, to: Vector3) {
  let minimum = 0;
  let maximum = 1;
  for (const plane of frustum.planes) {
    const start = plane.distanceToPoint(from);
    const end = plane.distanceToPoint(to);
    if (start < 0 && end < 0) {
      return;
    }
    if (start < 0) {
      minimum = Math.max(minimum, start / (start - end));
    }
    if (end < 0) {
      maximum = Math.min(maximum, start / (start - end));
    }
  }
  return minimum <= maximum ? { minimum, maximum } : undefined;
}

/** Keeps a Cartesian axis label at its visible end while the camera moves. */
function AxisLabel({
  color,
  from,
  to,
  name,
}: {
  color: string;
  from: Vector3;
  to: Vector3;
  name: AxisName;
}) {
  const group = useRef<Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const invalidate = useThree((state) => state.invalidate);
  const scratch = useMemo(
    () => ({
      end: new Vector3(),
      frustum: new Frustum(),
      height: 0,
      labelHeight: 0,
      labelWidth: 0,
      lastProjection: new Matrix4().multiplyScalar(0),
      lastTransform: "",
      lastVisible: false,
      lastWorld: new Matrix4().multiplyScalar(0),
      lastZoom: Number.NaN,
      offset: new Matrix4(),
      projection: new Matrix4(),
      screen: new Vector2(),
      start: new Vector3(),
      width: 0,
    }),
    []
  );
  const attachLabel = useCallback(
    (element: HTMLDivElement | null) => {
      label.current = element;
      if (!element) {
        return;
      }
      const measure = () => {
        scratch.labelWidth = element.offsetWidth;
        scratch.labelHeight = element.offsetHeight;
        scratch.width = 0;
        invalidate();
      };
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      measure();
      return () => observer.disconnect();
    },
    [invalidate, scratch]
  );

  // This is camera presentation state: update Three.js and DOM at the native
  // animation-frame boundary without React state or camera-framing feedback.
  // OrbitControls runs at -1 and SceneHtml places the label at 0. Move the label
  // between them so the final demand frame projects the current axis endpoint.
  useFrame(({ camera, size }) => {
    const object = group.current;
    const element = label.current;
    if (!(object && element)) {
      return;
    }
    camera.updateMatrixWorld();
    if (!updateAxisCameraCache(scratch, camera, size)) {
      return;
    }

    const marginX = scratch.labelWidth / 2 + LABEL_EDGE_SPACE;
    const marginY = scratch.labelHeight / 2 + LABEL_EDGE_SPACE;
    scratch.projection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    scratch.frustum.setFromProjectionMatrix(scratch.projection);
    const interval = clipAxis(scratch.frustum, from, to);
    if (!interval) {
      hideAxisLabel(element, scratch);
      return;
    }
    const { minimum, maximum } = interval;
    scratch.start.lerpVectors(from, to, minimum).project(camera);
    scratch.end.lerpVectors(from, to, maximum).project(camera);
    const dx = (scratch.end.x - scratch.start.x) * size.width;
    const dy = (scratch.start.y - scratch.end.y) * size.height;
    const length = Math.hypot(dx, dy);
    if (length <= 1) {
      // An end-on axis has no visible direction. Its label returns as soon as
      // orbiting reveals the axis instead of obscuring the plane's origin.
      hideAxisLabel(element, scratch);
      return;
    }
    let normalX = (-dy / length) * LABEL_GAP;
    let normalY = (dx / length) * LABEL_GAP;
    const horizontal = Math.max(0.1, 1 - (2 * marginX) / size.width);
    const vertical = Math.max(0.1, 1 - (2 * marginY) / size.height);
    let endpoint = maximum;
    // Reserve space only on the chosen side of the axis. A symmetric inset
    // can reject a visible axis even when its other side has ample room.
    for (const side of LABEL_SIDES) {
      scratch.offset.makeTranslation(
        (2 * normalX * side) / size.width,
        (-2 * normalY * side) / size.height,
        0
      );
      scratch.projection
        .makeScale(1 / horizontal, 1 / vertical, 1)
        .multiply(scratch.offset)
        .multiply(camera.projectionMatrix)
        .multiply(camera.matrixWorldInverse);
      scratch.frustum.setFromProjectionMatrix(scratch.projection);
      const labelInterval = clipAxis(scratch.frustum, from, to);
      if (
        labelInterval &&
        Math.max(minimum, labelInterval.minimum) <=
          Math.min(maximum, labelInterval.maximum)
      ) {
        endpoint = Math.min(maximum, labelInterval.maximum);
        normalX *= side;
        normalY *= side;
        break;
      }
    }
    object.position.lerpVectors(from, to, endpoint);
    object.updateMatrixWorld();
    scratch.end.copy(object.position).project(camera);
    const centerX = ((scratch.end.x + 1) * size.width) / 2;
    const centerY = ((1 - scratch.end.y) * size.height) / 2;
    if (!(Number.isFinite(centerX) && Number.isFinite(centerY))) {
      hideAxisLabel(element, scratch);
      return;
    }
    scratch.screen.set(centerX, centerY);
    const offsetX =
      Math.min(size.width - marginX, Math.max(marginX, centerX + normalX)) -
      centerX;
    const offsetY =
      Math.min(size.height - marginY, Math.max(marginY, centerY + normalY)) -
      centerY;
    showAxisLabel(element, scratch, offsetX, offsetY);
  }, -0.5);

  return (
    <group ref={group}>
      <SceneHtml
        // The frame sets scratch.screen only after its finite check, so this
        // projection always receives a finite point.
        calculatePosition={() => [scratch.screen.x, scratch.screen.y]}
        ref={attachLabel}
        style={{
          color,
          fontSize: 14,
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
          visibility: "hidden",
        }}
      >
        <span aria-hidden="true" data-axis-label={name}>
          <DrawnInlineMath html={AXIS_NAMES[name]} />
        </span>
      </SceneHtml>
    </group>
  );
}

/**
 * Renders the Cartesian axes of an unbounded world, through the origin and
 * across the whole reach (`createAxisGeometry`), with each name at the end of
 * its axis that the camera shows.
 */
export function Axes({
  reach = 100,
  showLabels = true,
  showZAxis = true,
  origin,
  ...props
}: {
  /** Half-width, in world units, of the box around the world's center that the camera can show. */
  reach?: number;
  showLabels?: boolean;
  showZAxis?: boolean;
  origin?: Point3 | undefined;
} & ComponentProps<"group">) {
  const axes = useMemo(() => {
    const geometry = createAxisGeometry(reach, origin);
    return Arr.map(
      [
        { name: "X" as const, color: AXIS_COLORS.x, geometry: geometry.x },
        { name: "Y" as const, color: AXIS_COLORS.y, geometry: geometry.y },
        { name: "Z" as const, color: AXIS_COLORS.z, geometry: geometry.z },
      ],
      ({ geometry: axis, ...identity }) => ({
        ...identity,
        visible: axis.visible && (identity.name !== "Z" || showZAxis),
        from: new Vector3(axis.from.x, axis.from.y, axis.from.z),
        to: new Vector3(axis.to.x, axis.to.y, axis.to.z),
      })
    );
  }, [origin, reach, showZAxis]);

  return (
    <group {...props}>
      {Arr.map(axes, (axis) =>
        axis.visible ? (
          <group key={axis.name}>
            <Line
              color={axis.color}
              lineWidth={2}
              points={[axis.from, axis.to]}
              // The grid's lines are transparent and draw after every opaque
              // object, so an opaque axis would show the grid line at zero as a
              // pale stripe down its middle. Drawing the axis in the same pass,
              // after the grid, keeps it one solid line.
              renderOrder={1}
              transparent
            />
            {showLabels ? (
              <AxisLabel
                color={axis.color}
                from={axis.from}
                name={axis.name}
                to={axis.to}
              />
            ) : null}
          </group>
        ) : null
      )}
    </group>
  );
}
