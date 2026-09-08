"use client";

import { Html, Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  type CoordinateFrame,
  type CoordinatePoint,
  createAxisGeometry,
  createSymmetricFrame,
} from "@repo/design-system/components/three/frame";
import { COLORS } from "@repo/design-system/lib/color";
import { type ComponentProps, useCallback, useMemo, useRef } from "react";
import { Frustum, type Group, Matrix4, Vector2, Vector3 } from "three";

const LABEL_EDGE_SPACE = 4;
const LABEL_GAP = 12;

/** Places a point-like axis label away from the framed subject. */
function pointLabelOffset(coordinate: number, extent: number, margin: number) {
  const preferred = coordinate < extent / 2 ? -LABEL_GAP : LABEL_GAP;
  const center = coordinate + preferred;
  return center < margin || center > extent - margin ? -preferred : preferred;
}

/** Intersects an axis segment with the six planes of the camera frustum. */
function clipAxis(frustum: Frustum, from: Vector3, to: Vector3) {
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
  name: string;
}) {
  const group = useRef<Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const invalidate = useThree((state) => state.invalidate);
  const attachLabel = useCallback(
    (element: HTMLDivElement | null) => {
      label.current = element;
      if (element) {
        invalidate();
      }
    },
    [invalidate]
  );
  const scratch = useMemo(
    () => ({
      frustum: new Frustum(),
      projection: new Matrix4(),
      offset: new Matrix4(),
      screen: new Vector2(),
      start: new Vector3(),
      end: new Vector3(),
    }),
    []
  );

  // This is camera presentation state: update Three.js and DOM at the native
  // animation-frame boundary without React state or camera-framing feedback.
  // OrbitControls runs at -1 and Html projects at 0. Move the label between
  // them so the final demand frame projects the current axis endpoint.
  useFrame(({ camera, size }) => {
    const object = group.current;
    const element = label.current;
    if (!(object && element)) {
      return;
    }
    camera.updateMatrixWorld();
    const marginX = element.offsetWidth / 2 + LABEL_EDGE_SPACE;
    const marginY = element.offsetHeight / 2 + LABEL_EDGE_SPACE;
    scratch.projection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    scratch.frustum.setFromProjectionMatrix(scratch.projection);
    const interval = clipAxis(scratch.frustum, from, to);
    if (!interval) {
      element.style.visibility = "hidden";
      return;
    }
    const { minimum, maximum } = interval;
    scratch.start.lerpVectors(from, to, minimum).project(camera);
    scratch.end.lerpVectors(from, to, maximum).project(camera);
    const dx = (scratch.end.x - scratch.start.x) * size.width;
    const dy = (scratch.start.y - scratch.end.y) * size.height;
    const length = Math.hypot(dx, dy);
    let normalX = (-dy / length) * LABEL_GAP;
    let normalY = (dx / length) * LABEL_GAP;
    if (length <= 1) {
      // An axis facing the camera projects to a point. Place its label away
      // from the framed subject, whose bounds determine the viewport center.
      normalX = pointLabelOffset(
        ((scratch.end.x + 1) * size.width) / 2,
        size.width,
        marginX
      );
      normalY = pointLabelOffset(
        ((1 - scratch.end.y) * size.height) / 2,
        size.height,
        marginY
      );
    }
    const horizontal = Math.max(0.1, 1 - (2 * marginX) / size.width);
    const vertical = Math.max(0.1, 1 - (2 * marginY) / size.height);
    let endpoint = maximum;
    // Reserve space only on the chosen side of the axis. A symmetric inset
    // can reject a visible axis even when its other side has ample room.
    for (const side of [1, -1]) {
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
      element.style.visibility = "hidden";
      return;
    }
    scratch.screen.set(centerX, centerY);
    const offsetX =
      Math.min(size.width - marginX, Math.max(marginX, centerX + normalX)) -
      centerX;
    const offsetY =
      Math.min(size.height - marginY, Math.max(marginY, centerY + normalY)) -
      centerY;
    element.style.visibility = "visible";
    element.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
  }, -0.5);

  return (
    <group ref={group}>
      <Html
        // Html must never cache the camera's non-finite mount projection.
        // The axis frame already owns the validated visible endpoint.
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
        zIndexRange={[1, 0]}
      >
        <span aria-hidden="true" data-axis-label={name}>
          <InlineMath math={name} />
        </span>
      </Html>
    </group>
  );
}

/** Renders full Cartesian axes with readable labels inside the scene viewport. */
export function Axes({
  size = 10,
  frame,
  showLabels = true,
  showZAxis = true,
  origin,
  ...props
}: {
  frame?: CoordinateFrame;
  size?: number;
  showLabels?: boolean;
  showZAxis?: boolean;
  origin?: CoordinatePoint;
} & ComponentProps<"group">) {
  const axes = useMemo(() => {
    const geometry = createAxisGeometry(
      frame ?? createSymmetricFrame(size),
      0,
      origin
    );
    return [
      { name: "X", color: COLORS.RED, geometry: geometry.x },
      { name: "Y", color: COLORS.GREEN, geometry: geometry.y },
      { name: "Z", color: COLORS.BLUE, geometry: geometry.z },
    ].map(({ geometry: axis, ...identity }) => ({
      ...identity,
      visible: axis.visible && (identity.name !== "Z" || showZAxis),
      from: new Vector3(axis.from.x, axis.from.y, axis.from.z),
      to: new Vector3(axis.to.x, axis.to.y, axis.to.z),
    }));
  }, [frame, origin, showZAxis, size]);

  return (
    <group {...props}>
      {axes.map((axis) =>
        axis.visible ? (
          <group key={axis.name}>
            <Line
              color={axis.color}
              lineWidth={2}
              points={[axis.from, axis.to]}
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
