"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car-model";
import {
  DISPLACEMENT_DISTANCE_CAMERA,
  DISPLACEMENT_DISTANCE_CAR_MODEL_PATH,
  DISPLACEMENT_DISTANCE_CASE_IDS,
  DISPLACEMENT_DISTANCE_COPY,
  DISPLACEMENT_DISTANCE_SCENE,
  type DisplacementDistanceCaseId,
  type DisplacementDistanceLocale,
  type DisplacementDistanceState,
  formatMeterMath,
  formatVectorMath,
  getDisplacementDistanceState,
  getRouteSampleAtProgress,
  isDisplacementDistanceCaseId,
  type RouteSegment,
} from "@repo/design-system/components/contents/physics/kinematics/displacement-distance/data";
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
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

const ROUTE_COLOR = "#0f9f95";
const DISPLACEMENT_COLOR = "#8b5cf6";
const CAR_COLOR = "#f97316";
const END_PAUSE_SECONDS = 0.9;
const MIN_TRAVEL_SECONDS = 4.8;
const TRAVEL_SECONDS_PER_METER = 0.56;

interface DisplacementDistanceLabProps {
  locale: DisplacementDistanceLocale;
}

export function DisplacementDistanceLab({
  locale,
}: DisplacementDistanceLabProps) {
  const [caseId, setCaseId] = useState<DisplacementDistanceCaseId>("turn");
  const labels = DISPLACEMENT_DISTANCE_COPY[locale];
  const motion = useMemo(() => getDisplacementDistanceState(caseId), [caseId]);

  function handleCaseChange(value: string) {
    if (!isDisplacementDistanceCaseId(value)) {
      return;
    }

    setCaseId(value);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseCase}
          className="grid w-full grid-cols-3"
          layout="grid"
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
              position: DISPLACEMENT_DISTANCE_CAMERA.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <ambientLight intensity={0.72} />
              <hemisphereLight
                color="#f8fafc"
                groundColor="#64748b"
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
              <DisplacementDistanceCamera />
              <DisplacementDistanceScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </CardContent>

      <CardFooter className="border-t">
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
      </CardFooter>
    </Card>
  );
}

function DisplacementDistanceCamera() {
  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={DISPLACEMENT_DISTANCE_CAMERA.cameraPosition}
      cameraTarget={DISPLACEMENT_DISTANCE_CAMERA.cameraTarget}
      enablePan
      enableRotate
      enableZoom
      maxDistance={14}
      minDistance={3}
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
      <CarContactShadow />
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
        <meshStandardMaterial color="#334155" roughness={0.74} />
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
          <meshStandardMaterial color="#f8fafc" roughness={0.58} />
        </mesh>
      ))}
    </group>
  );
}

function RouteLines({ motion }: { motion: DisplacementDistanceState }) {
  const routePoints = motion.route.map(
    (point) =>
      [point.x, DISPLACEMENT_DISTANCE_SCENE.routeLineY, point.z] as [
        number,
        number,
        number,
      ]
  );
  const displacementPoints = [
    [
      motion.start.x,
      DISPLACEMENT_DISTANCE_SCENE.displacementLineY,
      motion.start.z,
    ],
    [motion.end.x, DISPLACEMENT_DISTANCE_SCENE.displacementLineY, motion.end.z],
  ] as [number, number, number][];

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

function CarContactShadow() {
  return (
    <mesh
      position={[0, 0.012, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[1.45, 0.52, 1]}
    >
      <circleGeometry args={[0.72, 32]} />
      <meshBasicMaterial
        color="#0f172a"
        depthWrite={false}
        opacity={0.14}
        transparent
      />
    </mesh>
  );
}

function LabFact({
  indicatorColor,
  label,
  value,
}: {
  indicatorColor?: string;
  label: string;
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
