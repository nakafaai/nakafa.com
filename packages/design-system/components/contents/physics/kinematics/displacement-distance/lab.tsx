"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car-model";
import {
  DISPLACEMENT_DISTANCE_CAR_MODEL_PATH,
  DISPLACEMENT_DISTANCE_CASE_IDS,
  DISPLACEMENT_DISTANCE_SCENE,
  type DisplacementDistanceCaseId,
  type DisplacementDistanceLabProps,
  type DisplacementDistanceState,
  formatMeterMath,
  formatVectorMath,
  getDisplacementDistanceState,
  getDisplacementDistanceView,
  getRouteSampleAtProgress,
  isDisplacementDistanceCaseId,
  type RouteSegment,
} from "@repo/design-system/components/contents/physics/kinematics/displacement-distance/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import { type Group, Vector3 } from "three";

const ROUTE_COLOR = getColor("TEAL");
const DISPLACEMENT_COLOR = getColor("VIOLET", 500);
const CAR_COLOR = getColor("ORANGE", 500);
const END_PAUSE_SECONDS = 0.9;
const MIN_TRAVEL_SECONDS = 4.8;
const TRAVEL_SECONDS_PER_METER = 0.56;

export function DisplacementDistanceLab({
  title,
  description,
  labels,
}: DisplacementDistanceLabProps) {
  const [caseId, setCaseId] = useState<DisplacementDistanceCaseId>("turn");
  const motion = useMemo(() => getDisplacementDistanceState(caseId), [caseId]);
  const view = useMemo(() => getDisplacementDistanceView(motion), [motion]);

  function handleCaseChange(value: string) {
    if (!isDisplacementDistanceCaseId(value)) {
      return;
    }

    setCaseId(value);
  }

  return (
    <Frame className="overflow-hidden content-auto-card">
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>

      <FramePanel className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseCase}
          gridColumns="3"
          onValueChange={handleCaseChange}
          type="single"
          value={caseId}
          variant="outline"
        >
          {DISPLACEMENT_DISTANCE_CASE_IDS.map((caseOption) => (
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
              fov: 43,
              position: view.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <ambientLight intensity={0.72} />
              <hemisphereLight
                color={getColor("SLATE", 50)}
                groundColor={getColor("SLATE")}
                intensity={0.62}
              />
              <directionalLight
                castShadow
                intensity={1.26}
                position={[3.4, 5.4, 4.2]}
                shadow-bias={-0.0006}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <DisplacementDistanceCamera view={view} />
              <DisplacementDistanceScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </FramePanel>

      <FrameFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <LabFact
            indicatorColor={ROUTE_COLOR}
            label={labels.factLabels.distance}
            value={
              <InlineMath math={`s=${formatMeterMath(motion.distance)}`} />
            }
          />
          <LabFact
            indicatorColor={DISPLACEMENT_COLOR}
            label={labels.factLabels.displacement}
            value={
              <InlineMath
                math={`|\\Delta\\vec{r}|=${formatMeterMath(
                  motion.displacement
                )}`}
              />
            }
          />
          <LabFact
            label={labels.factLabels.vector}
            value={
              <InlineMath math={formatVectorMath(motion.displacementVector)} />
            }
          />
          <LabFact
            label={labels.factLabels.meaning}
            value={labels.meanings[motion.caseId]}
          />
        </dl>
      </FrameFooter>
    </Frame>
  );
}

function DisplacementDistanceCamera({
  view,
}: {
  view: ReturnType<typeof getDisplacementDistanceView>;
}) {
  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={view.cameraPosition}
      cameraTarget={view.cameraTarget}
      enablePan
      enableRotate
      enableZoom
      maxDistance={12}
      minDistance={2.8}
    />
  );
}

function DisplacementDistanceScene({
  motion,
}: {
  motion: DisplacementDistanceState;
}) {
  return (
    <group>
      <RouteRoad segments={motion.segments} />
      <RouteLines motion={motion} />
      <StartEndMarkers motion={motion} />
      <AnimatedCar motion={motion} />
    </group>
  );
}

function AnimatedCar({ motion }: { motion: DisplacementDistanceState }) {
  const carRef = useRef<Group>(null);
  const animationStartRef = useRef<number | null>(null);
  const animationCaseRef = useRef<DisplacementDistanceCaseId | null>(null);

  useFrame((state) => {
    if (!carRef.current) {
      return;
    }

    if (
      animationStartRef.current === null ||
      animationCaseRef.current !== motion.caseId
    ) {
      animationCaseRef.current = motion.caseId;
      animationStartRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - animationStartRef.current;
    const progress = getAnimationProgress(motion, elapsed);
    const sample = getRouteSampleAtProgress(motion, progress);

    carRef.current.position.set(sample.x, 0.035, sample.z);
    carRef.current.rotation.y = Math.PI / 2 - sample.angle;
  });

  return (
    <group ref={carRef} scale={DISPLACEMENT_DISTANCE_SCENE.carScale}>
      <PhysicsCarModel
        bodyColor={CAR_COLOR}
        modelPath={DISPLACEMENT_DISTANCE_CAR_MODEL_PATH}
      />
    </group>
  );
}

function RouteRoad({ segments }: { segments: RouteSegment[] }) {
  return (
    <group>
      {segments.map((segment) => (
        <RoadSegment
          key={`${segment.start.x}-${segment.start.z}-${segment.end.x}-${segment.end.z}`}
          segment={segment}
        />
      ))}
    </group>
  );
}

function RoadSegment({ segment }: { segment: RouteSegment }) {
  const roadLength =
    segment.length + DISPLACEMENT_DISTANCE_SCENE.roadOverhang * 2;
  const stripeCount = Math.max(
    1,
    Math.floor(roadLength / DISPLACEMENT_DISTANCE_SCENE.stripeSpacing)
  );
  const stripeSpacing = roadLength / stripeCount;
  const stripePositions = Array.from(
    { length: stripeCount },
    (_, index) => -roadLength / 2 + stripeSpacing * (index + 0.5)
  );

  return (
    <group
      position={[segment.center.x, -0.02, segment.center.z]}
      rotation={[0, -segment.angle, 0]}
    >
      <mesh receiveShadow>
        <boxGeometry
          args={[roadLength, 0.08, DISPLACEMENT_DISTANCE_SCENE.roadWidth]}
        />
        <meshStandardMaterial color={getColor("SLATE", 700)} roughness={0.74} />
      </mesh>

      {stripePositions.map((x) => (
        <mesh key={x} position={[x, 0.055, 0]}>
          <boxGeometry
            args={[
              DISPLACEMENT_DISTANCE_SCENE.stripeLength,
              0.018,
              DISPLACEMENT_DISTANCE_SCENE.stripeWidth,
            ]}
          />
          <meshStandardMaterial
            color={getColor("SLATE", 50)}
            roughness={0.58}
          />
        </mesh>
      ))}
    </group>
  );
}

function RouteLines({ motion }: { motion: DisplacementDistanceState }) {
  const routePoints = motion.route.map(
    (point) =>
      new Vector3(point.x, DISPLACEMENT_DISTANCE_SCENE.routeLineY, point.z)
  );
  const displacementPoints = [
    new Vector3(
      motion.start.x,
      DISPLACEMENT_DISTANCE_SCENE.displacementLineY,
      motion.start.z
    ),
    new Vector3(
      motion.end.x,
      DISPLACEMENT_DISTANCE_SCENE.displacementLineY,
      motion.end.z
    ),
  ];

  return (
    <>
      <Line color={ROUTE_COLOR} lineWidth={4} points={routePoints} />
      {motion.displacement > 0 ? (
        <Line
          color={DISPLACEMENT_COLOR}
          lineWidth={4}
          points={displacementPoints}
        />
      ) : null}
    </>
  );
}

function StartEndMarkers({ motion }: { motion: DisplacementDistanceState }) {
  return (
    <>
      <mesh position={[motion.start.x, 0.16, motion.start.z]}>
        <sphereGeometry args={[0.13, 24, 16]} />
        <meshStandardMaterial color={ROUTE_COLOR} roughness={0.42} />
      </mesh>
      <mesh position={[motion.end.x, 0.2, motion.end.z]}>
        <coneGeometry args={[0.14, 0.28, 28]} />
        <meshStandardMaterial color={CAR_COLOR} roughness={0.48} />
      </mesh>
    </>
  );
}

function LabFact({
  indicatorColor,
  label,
  value,
}: {
  indicatorColor?: string;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {indicatorColor ? (
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: indicatorColor }}
          />
        ) : null}
        {label}
      </dt>
      <dd className="wrap-break-word text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function getAnimationProgress(
  motion: DisplacementDistanceState,
  elapsedSeconds: number
) {
  const travelSeconds = Math.max(
    MIN_TRAVEL_SECONDS,
    motion.distance * TRAVEL_SECONDS_PER_METER
  );
  const loopSeconds = travelSeconds + END_PAUSE_SECONDS;
  const loopTime = elapsedSeconds % loopSeconds;

  if (loopTime >= travelSeconds) {
    return 1;
  }

  return loopTime / travelSeconds;
}
