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
import { Frustum, type Group, Matrix4, Vector3 } from "three";

const LABEL_INSET = 8;
const LABEL_EDGE_SPACE = 4;
const LABEL_GAP = 12;

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
    const horizontal = Math.max(0.1, 1 - (2 * LABEL_INSET) / size.width);
    const vertical = Math.max(0.1, 1 - (2 * LABEL_INSET) / size.height);
    scratch.projection
      .makeScale(1 / horizontal, 1 / vertical, 1)
      .multiply(camera.projectionMatrix)
      .multiply(camera.matrixWorldInverse);
    scratch.frustum.setFromProjectionMatrix(scratch.projection);
    const interval = clipAxis(scratch.frustum, from, to);
    if (!interval) {
      element.style.visibility = "hidden";
      return;
    }
    const { minimum, maximum } = interval;
    object.position.lerpVectors(from, to, maximum);
    object.updateMatrixWorld();
    scratch.start.lerpVectors(from, to, minimum).project(camera);
    scratch.end.copy(object.position).project(camera);
    const dx = (scratch.end.x - scratch.start.x) * size.width;
    const dy = (scratch.start.y - scratch.end.y) * size.height;
    const length = Math.hypot(dx, dy);
    const normalX = length > 1 ? (-dy / length) * LABEL_GAP : LABEL_GAP;
    const normalY = length > 1 ? (dx / length) * LABEL_GAP : -LABEL_GAP;
    const centerX = ((scratch.end.x + 1) * size.width) / 2;
    const centerY = ((1 - scratch.end.y) * size.height) / 2;
    const marginX = element.offsetWidth / 2 + LABEL_EDGE_SPACE;
    const marginY = element.offsetHeight / 2 + LABEL_EDGE_SPACE;
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
        ref={attachLabel}
        style={{
          color,
          fontSize: 14,
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
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
