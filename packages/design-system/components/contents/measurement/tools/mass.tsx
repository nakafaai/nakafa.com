import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh } from "three";

import { SceneLabel } from "../label";
import type { MeasurementSceneProps } from "./data";
import {
  MASS_ARM_LENGTH,
  MASS_BALANCE_DAMPING,
  MASS_BALANCE_MAX_FRAME_DELTA,
  MASS_BALANCE_MAX_TILT_RADIANS,
  MASS_BALANCE_REST_EPSILON,
  MASS_BALANCE_STIFFNESS,
  MASS_COLOR,
  MASS_LOAD_BOTTOM_OFFSET_Y,
  MASS_PAN_DROP_Y,
  MASS_PIVOT_Y,
  MASS_REFERENCE_GRAMS,
  MASS_SCENE_SCALE,
  MASS_WEIGHT_HEIGHT,
  MASS_WEIGHT_RADIUS,
  MASS_WEIGHT_TAPER_RATIO,
  METAL_COLOR,
  OBJECT_COLOR,
  RULER_COLOR,
} from "./data";

/**
 * Renders an equal-arm balance driven by the net torque direction.
 *
 * The object sits on the left pan and is compared with a fixed reference mass
 * on the right pan. The zero point is exact for an equal-arm balance:
 * `tau_net = (m_object - m_reference) g r`, so matching masses settle level.
 *
 * @see https://openstax.org/books/university-physics-volume-1/pages/10-6-torque
 * @see https://openstax.org/books/physics/pages/6-3-rotational-motion
 */
export function MassScene({
  colors,
  measurement,
  reading,
}: MeasurementSceneProps) {
  const targetTilt = getBalanceTilt(measurement);
  const currentTilt = useRef(targetTilt);
  const currentVelocity = useRef(0);
  const beamRef = useRef<Group>(null);
  const leftHangerRef = useRef<Mesh>(null);
  const rightHangerRef = useRef<Mesh>(null);
  const leftPanRef = useRef<Group>(null);
  const rightPanRef = useRef<Group>(null);
  const leftPanPosition = getPanPosition(-MASS_ARM_LENGTH, currentTilt.current);
  const rightPanPosition = getPanPosition(MASS_ARM_LENGTH, currentTilt.current);
  const objectSize = getScaledMassSize(measurement);
  const referenceSize = getScaledMassSize(MASS_REFERENCE_GRAMS);
  const referenceReading = `${MASS_REFERENCE_GRAMS} g`;

  useFrame((state, delta) => {
    const beam = beamRef.current;
    const leftHanger = leftHangerRef.current;
    const rightHanger = rightHangerRef.current;
    const leftPan = leftPanRef.current;
    const rightPan = rightPanRef.current;

    if (!(beam && leftHanger && rightHanger && leftPan && rightPan)) {
      return;
    }

    const nextMotion = getNextBalanceMotion(
      currentTilt.current,
      currentVelocity.current,
      targetTilt,
      delta
    );

    currentTilt.current = nextMotion.tilt;
    currentVelocity.current = nextMotion.velocity;

    applyBalancePose(
      nextMotion.tilt,
      beam,
      leftHanger,
      rightHanger,
      leftPan,
      rightPan
    );

    if (nextMotion.isResting) {
      return;
    }

    state.invalidate();
  });

  return (
    <group
      position={[0, 0.35, 0]}
      rotation={[-0.15, -0.35, 0]}
      scale={MASS_SCENE_SCALE}
    >
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[1.25, 1.45, 0.25, 48]} />
        <meshStandardMaterial color={METAL_COLOR} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 2, 24]} />
        <meshStandardMaterial color={METAL_COLOR} metalness={0.35} />
      </mesh>
      <group
        position={[0, MASS_PIVOT_Y, 0]}
        ref={beamRef}
        rotation={[0, 0, currentTilt.current]}
      >
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 4.6, 24]} />
          <meshStandardMaterial color={METAL_COLOR} metalness={0.35} />
        </mesh>
      </group>
      <mesh position={[0, MASS_PIVOT_Y, 0]}>
        <sphereGeometry args={[0.13, 32, 32]} />
        <meshStandardMaterial color={METAL_COLOR} metalness={0.35} />
      </mesh>
      <mesh
        position={[leftPanPosition.x, leftPanPosition.hangerY, 0]}
        ref={leftHangerRef}
      >
        <boxGeometry args={[0.035, MASS_PAN_DROP_Y, 0.035]} />
        <meshStandardMaterial color={METAL_COLOR} metalness={0.35} />
      </mesh>
      <mesh
        position={[rightPanPosition.x, rightPanPosition.hangerY, 0]}
        ref={rightHangerRef}
      >
        <boxGeometry args={[0.035, MASS_PAN_DROP_Y, 0.035]} />
        <meshStandardMaterial color={METAL_COLOR} metalness={0.35} />
      </mesh>
      <group
        position={[leftPanPosition.x, leftPanPosition.panY, 0]}
        ref={leftPanRef}
      >
        <mesh>
          <cylinderGeometry args={[0.75, 0.62, 0.18, 48]} />
          <meshStandardMaterial color={MASS_COLOR} roughness={0.45} />
        </mesh>
        <RoundedBox
          args={[0.9 * objectSize.scale, 0.55 * objectSize.scale, 0.9]}
          position={[0, MASS_LOAD_BOTTOM_OFFSET_Y + objectSize.height / 2, 0]}
        >
          <meshStandardMaterial color={OBJECT_COLOR} roughness={0.5} />
        </RoundedBox>
      </group>
      <group
        position={[rightPanPosition.x, rightPanPosition.panY, 0]}
        ref={rightPanRef}
      >
        <mesh>
          <cylinderGeometry args={[0.75, 0.62, 0.18, 48]} />
          <meshStandardMaterial color={MASS_COLOR} roughness={0.45} />
        </mesh>
        <mesh
          position={[
            0,
            MASS_LOAD_BOTTOM_OFFSET_Y + referenceSize.height / 2,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              referenceSize.radius,
              referenceSize.radius * MASS_WEIGHT_TAPER_RATIO,
              referenceSize.height,
              40,
            ]}
          />
          <meshStandardMaterial color={RULER_COLOR} roughness={0.45} />
        </mesh>
      </group>
      <SceneLabel
        color={colors.text}
        fontSize={0.24}
        position={[-MASS_ARM_LENGTH, 0.45, 1.05]}
      >
        {reading}
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize={0.24}
        position={[MASS_ARM_LENGTH, 0.45, 1.05]}
      >
        {referenceReading}
      </SceneLabel>
    </group>
  );
}

/**
 * Maps equal-arm torque imbalance into the visible mechanical stop range.
 *
 * The sign and zero point come from `tau = rF`. The clamp is the instrument's
 * visual stop, so the scene never implies an unlimited physical rotation.
 *
 * @see https://openstax.org/books/college-physics-ap-courses/pages/9-2-the-second-condition-for-equilibrium
 */
function getBalanceTilt(objectMassGrams: number) {
  const torqueRatio =
    (objectMassGrams - MASS_REFERENCE_GRAMS) / MASS_REFERENCE_GRAMS;
  const constrainedTorqueRatio = Math.max(-1, Math.min(1, torqueRatio));

  return constrainedTorqueRatio * MASS_BALANCE_MAX_TILT_RADIANS;
}

/**
 * Keeps object volume proportional to mass when the material density is fixed.
 */
function getScaledMassSize(massGrams: number) {
  const scale = Math.cbrt(massGrams / MASS_REFERENCE_GRAMS);

  return {
    height: MASS_WEIGHT_HEIGHT * scale,
    radius: MASS_WEIGHT_RADIUS * scale,
    scale,
  };
}

/**
 * Calculates where one pan hangs after the beam rotates around the pivot.
 */
function getPanPosition(armOffsetX: number, tilt: number) {
  const x = Math.cos(tilt) * armOffsetX;
  const beamY = MASS_PIVOT_Y + Math.sin(tilt) * armOffsetX;
  const panY = beamY - MASS_PAN_DROP_Y;

  return {
    beamY,
    hangerY: (beamY + panY) / 2,
    panY,
    x,
  };
}

/**
 * Advances the damped beam motion toward the torque-derived target angle.
 *
 * Frame delta is capped so a background tab cannot resume with one oversized
 * integration step that makes the balance jump through the target.
 */
function getNextBalanceMotion(
  currentTilt: number,
  currentVelocity: number,
  targetTilt: number,
  delta: number
) {
  const frameDelta = Math.min(delta, MASS_BALANCE_MAX_FRAME_DELTA);
  const angularAcceleration =
    (targetTilt - currentTilt) * MASS_BALANCE_STIFFNESS -
    currentVelocity * MASS_BALANCE_DAMPING;
  const velocity = currentVelocity + angularAcceleration * frameDelta;
  const tilt = currentTilt + velocity * frameDelta;
  const isResting =
    Math.abs(tilt - targetTilt) < MASS_BALANCE_REST_EPSILON &&
    Math.abs(velocity) < MASS_BALANCE_REST_EPSILON;

  if (isResting) {
    return {
      isResting,
      tilt: targetTilt,
      velocity: 0,
    };
  }

  return {
    isResting,
    tilt,
    velocity,
  };
}

/**
 * Applies the same beam angle to all visible balance parts.
 */
function applyBalancePose(
  tilt: number,
  beam: Group,
  leftHanger: Mesh,
  rightHanger: Mesh,
  leftPan: Group,
  rightPan: Group
) {
  const leftPanPosition = getPanPosition(-MASS_ARM_LENGTH, tilt);
  const rightPanPosition = getPanPosition(MASS_ARM_LENGTH, tilt);

  beam.rotation.z = tilt;
  leftHanger.position.set(leftPanPosition.x, leftPanPosition.hangerY, 0);
  rightHanger.position.set(rightPanPosition.x, rightPanPosition.hangerY, 0);
  leftPan.position.set(leftPanPosition.x, leftPanPosition.panY, 0);
  rightPan.position.set(rightPanPosition.x, rightPanPosition.panY, 0);
}
