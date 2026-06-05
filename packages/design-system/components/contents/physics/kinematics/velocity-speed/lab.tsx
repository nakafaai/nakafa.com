"use client";

import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car-model";
import {
  formatMeterMath,
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
  type VelocitySpeedCaseId,
  type VelocitySpeedLabProps,
  type VelocitySpeedState,
} from "@repo/design-system/components/contents/physics/kinematics/velocity-speed/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { getColor } from "@repo/design-system/lib/color";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

const PAUSE_SECONDS = 0.8;
const LANE_Y = -0.03;
const CAR_Y = 0.02;
const GUIDE_Y = 0.065;
const DISTANCE_GUIDE_Z = -0.46;
const DISTANCE_GUIDE_STEP = 0.18;
const DISPLACEMENT_GUIDE_Z = 0.46;
const GUIDE_THICKNESS = 0.045;
const ROUTE_CONE_Z = DISTANCE_GUIDE_Z - DISTANCE_GUIDE_STEP * 1.35;

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
      math: `s=${formatMeterMath(motion.distance)}`,
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
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseCase}
          gridColumns="3"
          onValueChange={handleCaseChange}
          type="single"
          value={caseId}
          variant="outline"
        >
          {VELOCITY_SPEED_CASE_IDS.map((caseOption) => (
            <ToggleGroupItem key={caseOption} value={caseOption}>
              {labels.modeLabels[caseOption]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{
              fov: VELOCITY_SPEED_CAMERA.fov,
              position: VELOCITY_SPEED_CAMERA.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <ambientLight intensity={0.9} />
              <hemisphereLight
                color={getColor("WHITE")}
                groundColor={getColor("SLATE", 400)}
                intensity={0.9}
              />
              <directionalLight
                castShadow
                intensity={1.58}
                position={[3.2, 6.2, 4.8]}
                shadow-bias={-0.0006}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <directionalLight intensity={0.48} position={[-4.2, 3.5, -3]} />
              <CameraControls
                autoRotate={false}
                cameraPosition={VELOCITY_SPEED_CAMERA.cameraPosition}
                cameraTarget={VELOCITY_SPEED_CAMERA.cameraTarget}
                enablePan
                enableRotate
                enableZoom
                fov={VELOCITY_SPEED_CAMERA.fov}
                maxDistance={VELOCITY_SPEED_CAMERA.maxDistance}
                minDistance={VELOCITY_SPEED_CAMERA.minDistance}
              />
              <VelocitySpeedScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {facts.map((fact) => (
            <div className="flex min-w-0 flex-col gap-1" key={fact.id}>
              <dt className="flex items-center gap-2 text-muted-foreground">
                {"markerColor" in fact ? (
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: fact.markerColor }}
                  />
                ) : null}
                {fact.label}
              </dt>
              <dd className="wrap-break-word text-foreground tabular-nums">
                <InlineMath math={fact.math} />
              </dd>
            </div>
          ))}
        </dl>
      </CardFooter>
    </Card>
  );
}

function VelocitySpeedScene({ motion }: { motion: VelocitySpeedState }) {
  return (
    <group>
      <Road />
      <MotionGuides motion={motion} />
      <RouteCones motion={motion} />
      <AnimatedCar motion={motion} />
    </group>
  );
}

function Road() {
  const stripeCount = Math.ceil(
    VELOCITY_SPEED_SCENE.laneLength / VELOCITY_SPEED_SCENE.stripeSpacing
  );
  const stripeSpacing = VELOCITY_SPEED_SCENE.laneLength / stripeCount;
  const stripePositions = Array.from(
    { length: stripeCount },
    (_, index) =>
      -VELOCITY_SPEED_SCENE.laneLength / 2 + stripeSpacing * (index + 0.5)
  );

  return (
    <group>
      <mesh position={[0, LANE_Y, 0]} receiveShadow>
        <boxGeometry
          args={[
            VELOCITY_SPEED_SCENE.laneLength,
            0.08,
            VELOCITY_SPEED_SCENE.laneWidth,
          ]}
        />
        <meshStandardMaterial
          color={VELOCITY_SPEED_COLORS.lane}
          roughness={0.72}
        />
      </mesh>

      {stripePositions.map((x) => (
        <mesh key={x} position={[x, 0.035, 0]}>
          <boxGeometry
            args={[
              VELOCITY_SPEED_SCENE.stripeLength,
              0.018,
              VELOCITY_SPEED_SCENE.stripeWidth,
            ]}
          />
          <meshStandardMaterial
            color={VELOCITY_SPEED_COLORS.stripe}
            roughness={0.58}
          />
        </mesh>
      ))}
    </group>
  );
}

function MotionGuides({ motion }: { motion: VelocitySpeedState }) {
  return (
    <group>
      <DistanceGuide motion={motion} />
      <DisplacementGuide motion={motion} />
    </group>
  );
}

function RouteCones({ motion }: { motion: VelocitySpeedState }) {
  const routeWaypoints = getRouteWaypoints(motion);

  return (
    <group>
      {routeWaypoints.map((x) => (
        <TrafficCone key={x} x={x} />
      ))}
    </group>
  );
}

function TrafficCone({ x }: { x: number }) {
  return (
    <group position={[x, 0, ROUTE_CONE_Z]}>
      <mesh castShadow position={[0, 0.31, 0]}>
        <coneGeometry args={[0.21, 0.48, 28]} />
        <meshStandardMaterial
          color={VELOCITY_SPEED_COLORS.coneBody}
          roughness={0.48}
        />
      </mesh>
      <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.126, 0.012, 8, 28]} />
        <meshStandardMaterial
          color={VELOCITY_SPEED_COLORS.coneBand}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 0.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.077, 0.008, 8, 28]} />
        <meshStandardMaterial
          color={VELOCITY_SPEED_COLORS.coneBand}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[0.4, 0.035, 0.4]} />
        <meshStandardMaterial
          color={VELOCITY_SPEED_COLORS.coneBase}
          roughness={0.68}
        />
      </mesh>
    </group>
  );
}

function getRouteWaypoints(motion: VelocitySpeedState) {
  const waypointSet = new Set<number>();

  for (const segment of motion.segments) {
    waypointSet.add(roundWaypoint(segment.startX));
    waypointSet.add(roundWaypoint(segment.endX));
  }

  return Array.from(waypointSet);
}

function DistanceGuide({ motion }: { motion: VelocitySpeedState }) {
  return (
    <group>
      {motion.segments.map((segment, index) => (
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
  const length = Math.abs(endX - startX);

  if (length === 0) {
    return null;
  }

  return (
    <mesh position={[(startX + endX) / 2, GUIDE_Y, z]} renderOrder={1}>
      <boxGeometry args={[length, 0.035, GUIDE_THICKNESS]} />
      <meshBasicMaterial color={color} />
    </mesh>
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
  const startRef = useRef<number | null>(null);
  const caseRef = useRef<VelocitySpeedCaseId | null>(null);

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    if (startRef.current === null || caseRef.current !== motion.caseId) {
      caseRef.current = motion.caseId;
      startRef.current = state.clock.elapsedTime;
    }

    const elapsed =
      (state.clock.elapsedTime - startRef.current) %
      (motion.duration + PAUSE_SECONDS);
    const sample = getVelocitySpeedSample(motion, elapsed);
    const rotationY = sample.direction > 0 ? Math.PI / 2 : -Math.PI / 2;

    groupRef.current.position.set(sample.x, CAR_Y, 0);
    groupRef.current.rotation.y = rotationY;
  });

  return (
    <group ref={groupRef} scale={VELOCITY_SPEED_SCENE.carScale}>
      <CarContactShadow />
      <PhysicsCarModel
        bodyColor={VELOCITY_SPEED_COLORS.carBody}
        modelPath={VELOCITY_SPEED_CAR_MODEL_PATH}
      />
    </group>
  );
}

function CarContactShadow() {
  return (
    <mesh
      position={[0, 0.01, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[1.18, 3.2, 1]}
    >
      <circleGeometry args={[1, 36]} />
      <meshBasicMaterial
        color={VELOCITY_SPEED_COLORS.shadow}
        opacity={0.16}
        transparent
      />
    </mesh>
  );
}
