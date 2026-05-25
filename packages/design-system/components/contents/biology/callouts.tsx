"use client";

import type {
  BiologyLabCallout,
  BiologyScenePoint,
} from "@repo/design-system/components/contents/biology/data";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const BIOLOGY_CALLOUT_ARROW_SIZE = 0.045;
const BIOLOGY_CALLOUT_LABEL_CLEARANCE = 0.18;
const BIOLOGY_CALLOUT_TARGET_CLEARANCE = BIOLOGY_CALLOUT_ARROW_SIZE;

export interface BiologyCalloutTarget {
  id: string;
  labelPosition: BiologyScenePoint;
  target?: BiologyScenePoint;
}

/**
 * Renders localized scene callouts by matching lesson labels to stable model
 * coordinates, so labels stay reusable without hard-coding text in TSX.
 */
export function BiologyCallouts({
  callouts,
  color,
  targets,
}: {
  callouts?: readonly BiologyLabCallout[];
  color: string;
  targets: readonly BiologyCalloutTarget[];
}) {
  if (!callouts?.length) {
    return null;
  }

  return (
    <>
      {targets.map((target) => {
        const callout = callouts.find((item) => item.id === target.id);

        if (!callout) {
          return null;
        }

        return (
          <BiologyCallout
            color={color}
            key={target.id}
            label={callout.label}
            labelPosition={target.labelPosition}
            target={target.target}
          />
        );
      })}
    </>
  );
}

/**
 * Connects one short label to a specific structure only when an arrow reduces
 * ambiguity. Broad labels can stay as plain scene labels.
 */
function BiologyCallout({
  color,
  label,
  labelPosition,
  target,
}: {
  color: string;
  label: string;
  labelPosition: BiologyScenePoint;
  target?: BiologyScenePoint;
}) {
  if (!target) {
    return (
      <SceneLabel color={color} fontSize="marker" position={labelPosition}>
        {label}
      </SceneLabel>
    );
  }

  const arrowStart = getBiologyCalloutArrowStart(labelPosition, target);
  const arrowEnd = getBiologyCalloutArrowEnd(labelPosition, target);

  return (
    <group>
      <SceneLabel color={color} fontSize="marker" position={labelPosition}>
        {label}
      </SceneLabel>
      <ArrowHelper
        arrowSize={BIOLOGY_CALLOUT_ARROW_SIZE}
        color={color}
        from={arrowStart}
        lineWidth={1}
        to={arrowEnd}
      />
    </group>
  );
}

/**
 * Starts the arrow slightly away from the label so text and arrowheads do not
 * collide even when the camera orbit changes within the scene limits.
 */
function getBiologyCalloutArrowStart(
  labelPosition: BiologyScenePoint,
  target: BiologyScenePoint
) {
  const [labelX, labelY, labelZ] = labelPosition;
  const [targetX, targetY, targetZ] = target;
  const vector = [
    targetX - labelX,
    targetY - labelY,
    targetZ - labelZ,
  ] satisfies BiologyScenePoint;
  const length = Math.hypot(...vector);

  if (length === 0) {
    return labelPosition;
  }

  const clearance = Math.min(BIOLOGY_CALLOUT_LABEL_CLEARANCE, length * 0.35);

  return [
    labelX + (vector[0] / length) * clearance,
    labelY + (vector[1] / length) * clearance,
    labelZ + (vector[2] / length) * clearance,
  ] satisfies BiologyScenePoint;
}

/**
 * Stops the arrow just before the target so the arrowhead points at a
 * structure without covering its surface detail.
 */
function getBiologyCalloutArrowEnd(
  labelPosition: BiologyScenePoint,
  target: BiologyScenePoint
) {
  const [labelX, labelY, labelZ] = labelPosition;
  const [targetX, targetY, targetZ] = target;
  const vector = [
    labelX - targetX,
    labelY - targetY,
    labelZ - targetZ,
  ] satisfies BiologyScenePoint;
  const length = Math.hypot(...vector);

  if (length === 0) {
    return target;
  }

  const clearance = Math.min(BIOLOGY_CALLOUT_TARGET_CLEARANCE, length * 0.25);

  return [
    targetX + (vector[0] / length) * clearance,
    targetY + (vector[1] / length) * clearance,
    targetZ + (vector[2] / length) * clearance,
  ] satisfies BiologyScenePoint;
}
