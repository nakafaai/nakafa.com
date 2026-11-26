import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car";
import { formatKeptZeroMeterMath } from "@repo/design-system/components/contents/physics/kinematics/math";
import type {
  VelocitySpeedCaseId,
  VelocitySpeedState,
} from "@repo/design-system/components/contents/physics/kinematics/velocity-speed/data";
import {
  formatSignedMeterMath,
  formatSignedSpeedMath,
  formatSpeedMath,
  getVelocitySpeedSample,
  getVelocitySpeedState,
  isVelocitySpeedCaseId,
  VELOCITY_SPEED_CAMERA,
  VELOCITY_SPEED_CAR_MODEL_PATH,
  VELOCITY_SPEED_CASE_IDS,
  VELOCITY_SPEED_COLORS,
  VELOCITY_SPEED_SCENE,
} from "@repo/design-system/components/contents/physics/kinematics/velocity-speed/data";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Road } from "@repo/design-system/components/three/stage/road";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactIndicator } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

const PAUSE_SECONDS = 0.8;
/** The height of the road the car drives on. */
const ROAD_Y = 0.01;
const CAR_Y = 0.02;
const GUIDE_Y = 0.065;
const DISTANCE_GUIDE_Z = -0.46;
const DISTANCE_GUIDE_STEP = 0.18;
const DISPLACEMENT_GUIDE_Z = 0.46;
const GUIDE_THICKNESS = 0.045;
const ROUTE_CONE_Z = DISTANCE_GUIDE_Z - DISTANCE_GUIDE_STEP * 1.35;
/** How far the lab reaches from its middle, which its shadows cover. */
const SCENE_REACH =
  VELOCITY_SPEED_SCENE.laneLength / 2 + VELOCITY_SPEED_SCENE.laneWidth;

interface VelocitySpeedLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    chooseCase: string;
    factLabels: {
      displacement: ReactNode;
      distance: ReactNode;
      speed: ReactNode;
      velocity: ReactNode;
    };
    modeLabels: Record<VelocitySpeedCaseId, ReactNode>;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

export function VelocitySpeedLab({
  title,
  description,
  labels,
}: VelocitySpeedLabProps) {
  const [caseId, setCaseId] = useState<VelocitySpeedCaseId>("partialReturn");
  const motion = useMemo(() => getVelocitySpeedState(caseId), [caseId]);
  const facts = [
    {
      id: "distance",
      label: labels.factLabels.distance,
      math: `s=${formatKeptZeroMeterMath(motion.distance)}`,
      markerColor: VELOCITY_SPEED_COLORS.distanceGuide,
    },
    {
      id: "displacement",
      label: labels.factLabels.displacement,
      math: `\\Delta x=${formatSignedMeterMath(motion.displacement)}`,
      markerColor: VELOCITY_SPEED_COLORS.displacementGuide,
    },
    {
      id: "speed",
      label: labels.factLabels.speed,
      math: `\\frac{s}{\\Delta t}=${formatSpeedMath(motion.speed)}`,
    },
    {
      id: "velocity",
      label: labels.factLabels.velocity,
      math: `v=${formatSignedSpeedMath(motion.velocity)}`,
    },
  ];

  function handleCaseChange(value: string) {
    if (!isVelocitySpeedCaseId(value)) {
      return;
    }

    setCaseId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseCase}
          gridColumns="3"
          onValueChange={handleCaseChange}
          type="single"
          value={caseId}
          variant="outline"
        >
          {Arr.map(VELOCITY_SPEED_CASE_IDS, (caseOption) => (
            <ToggleGroupItem key={caseOption} value={caseOption}>
              {labels.modeLabels[caseOption]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={ROAD_Y}
          frameloop="always"
          ground="grass"
          reach={SCENE_REACH}
          setting="field"
        >
          <Suspense>
            <CameraControls
              cameraPosition={VELOCITY_SPEED_CAMERA.cameraPosition}
              cameraTarget={VELOCITY_SPEED_CAMERA.cameraTarget}
              enablePan
              enableRotate
              enableZoom
              fov={VELOCITY_SPEED_CAMERA.fov}
            />
            <group>
              <Road
                dash={VELOCITY_SPEED_SCENE.stripeLength}
                spacing={VELOCITY_SPEED_SCENE.stripeSpacing}
                width={VELOCITY_SPEED_SCENE.laneWidth}
              />
              <group>
                <DistanceGuide motion={motion} />
                <DisplacementGuide motion={motion} />
              </group>
              <RouteCones motion={motion} />
              <AnimatedCar motion={motion} />
            </group>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(facts, (fact) => (
            <VisualFactIndicator
              indicatorColor={
                "markerColor" in fact ? fact.markerColor : undefined
              }
              key={fact.id}
              label={fact.label}
              value={<InlineMath math={fact.math} />}
            />
          ))}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

function RouteCones({ motion }: { motion: VelocitySpeedState }) {
  const routeWaypoints = getRouteWaypoints(motion);

  return (
    <group>
      {Arr.map(routeWaypoints, (x) => (
        <TrafficCone key={x} x={x} />
      ))}
    </group>
  );
}

function TrafficCone({ x }: { x: number }) {
  return (
    <group position={[x, ROAD_Y, ROUTE_CONE_Z]}>
      {/* Weighted octagonal rubber base */}
      <mesh castShadow position={[0, 0.024, 0]} receiveShadow>
        <cylinderGeometry args={[0.2, 0.23, 0.048, 8]} />
        <meshStandardMaterial
          color={VELOCITY_SPEED_COLORS.coneBase}
          roughness={0.82}
        />
      </mesh>
      {/* Tapered PVC safety cone body */}
      <mesh castShadow position={[0, 0.28, 0]} receiveShadow>
        <cylinderGeometry args={[0.036, 0.175, 0.48, 32]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={VELOCITY_SPEED_COLORS.coneBody}
          roughness={0.36}
        />
      </mesh>
      {/* Lower flush retro-reflective sleeve */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.12, 0.146, 0.082, 32, 1, true]} />
        <meshStandardMaterial
          color={VELOCITY_SPEED_COLORS.coneBand}
          emissive={VELOCITY_SPEED_COLORS.coneBand}
          emissiveIntensity={0.22}
          roughness={0.24}
        />
      </mesh>
      {/* Upper flush retro-reflective sleeve */}
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.082, 0.1, 0.058, 32, 1, true]} />
        <meshStandardMaterial
          color={VELOCITY_SPEED_COLORS.coneBand}
          emissive={VELOCITY_SPEED_COLORS.coneBand}
          emissiveIntensity={0.22}
          roughness={0.24}
        />
      </mesh>
    </group>
  );
}

/** Every point where the route starts, turns, or ends, each once in route order. */
function getRouteWaypoints(motion: VelocitySpeedState) {
  return Arr.dedupe(
    Arr.flatMap(motion.segments, (segment) => [
      roundWaypoint(segment.startX),
      roundWaypoint(segment.endX),
    ])
  );
}

function DistanceGuide({ motion }: { motion: VelocitySpeedState }) {
  return (
    <group>
      {Arr.map(motion.segments, (segment, index) => (
        <GuideSegment
          color={VELOCITY_SPEED_COLORS.distanceGuide}
          endX={segment.endX}
          key={`${segment.startX}-${segment.endX}-${segment.direction}`}
          startX={segment.startX}
          z={getDistanceGuideZ(index)}
        />
      ))}
    </group>
  );
}

function DisplacementGuide({ motion }: { motion: VelocitySpeedState }) {
  if (motion.displacement === 0) {
    return null;
  }

  return (
    <GuideSegment
      color={VELOCITY_SPEED_COLORS.displacementGuide}
      endX={motion.endX}
      startX={motion.startX}
      z={DISPLACEMENT_GUIDE_Z}
    />
  );
}

function GuideSegment({
  color,
  endX,
  startX,
  z,
}: {
  color: string;
  endX: number;
  startX: number;
  z: number;
}) {
  const delta = endX - startX;
  const totalLength = Math.abs(delta);

  if (totalLength === 0) {
    return null;
  }

  const sign = delta > 0 ? 1 : -1;
  const headLength = Math.min(0.28, totalLength * 0.25);
  const shaftLength = Math.max(0.01, totalLength - headLength);
  const shaftCenterX = startX + (sign * shaftLength) / 2;
  const headCenterX = endX - (sign * headLength) / 2;

  return (
    <group>
      <mesh
        castShadow
        position={[shaftCenterX, GUIDE_Y, z]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry
          args={[
            GUIDE_THICKNESS * 0.55,
            GUIDE_THICKNESS * 0.55,
            shaftLength,
            16,
          ]}
        />
        <meshPhysicalMaterial
          clearcoat={0.65}
          color={color}
          emissive={color}
          emissiveIntensity={0.22}
          roughness={0.26}
        />
      </mesh>
      <mesh
        castShadow
        position={[headCenterX, GUIDE_Y, z]}
        rotation={[0, 0, sign > 0 ? -Math.PI / 2 : Math.PI / 2]}
      >
        <coneGeometry args={[GUIDE_THICKNESS * 1.45, headLength, 20]} />
        <meshPhysicalMaterial
          clearcoat={0.65}
          color={color}
          emissive={color}
          emissiveIntensity={0.28}
          roughness={0.22}
        />
      </mesh>
    </group>
  );
}

function getDistanceGuideZ(index: number) {
  return DISTANCE_GUIDE_Z - DISTANCE_GUIDE_STEP * index;
}

function roundWaypoint(value: number) {
  return Number(value.toFixed(3));
}

function AnimatedCar({ motion }: { motion: VelocitySpeedState }) {
  const groupRef = useRef<Group>(null);
  const { advance, time: simTime } = useSimulationClock(0);
  const caseRef = useRef<VelocitySpeedCaseId>(motion.caseId);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    if (caseRef.current !== motion.caseId) {
      caseRef.current = motion.caseId;
      simTime.current = 0;
    }

    const elapsed = advance(delta) % (motion.duration + PAUSE_SECONDS);
    const sample = getVelocitySpeedSample(motion, elapsed);
    const rotationY = sample.direction > 0 ? Math.PI / 2 : -Math.PI / 2;

    groupRef.current.position.set(sample.x, CAR_Y, 0);
    groupRef.current.rotation.y = rotationY;
  });

  return (
    <CameraBounds
      motion={{
        rotation: "y",
        translation: {
          x: {
            min: Math.min(motion.startX, motion.turnX, motion.endX),
            max: Math.max(motion.startX, motion.turnX, motion.endX),
          },
          y: { min: CAR_Y, max: CAR_Y },
          z: { min: 0, max: 0 },
        },
      }}
      objectRef={groupRef}
    >
      <group scale={VELOCITY_SPEED_SCENE.carScale}>
        <PhysicsCarModel
          bodyColor={VELOCITY_SPEED_COLORS.carBody}
          modelPath={VELOCITY_SPEED_CAR_MODEL_PATH}
        />
      </group>
    </CameraBounds>
  );
}
