"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car-model";
import {
  DISPLACEMENT_DISTANCE_CAR_MODEL_PATH,
  DISPLACEMENT_DISTANCE_CASE_IDS,
  DISPLACEMENT_DISTANCE_SCENE,
  type DisplacementDistanceCaseId,
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
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import { VisualFactIndicator } from "@repo/design-system/components/visual/fact";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import { type Group, Vector3 } from "three";

const ROUTE_COLOR = getColor("TEAL");
const DISPLACEMENT_COLOR = getColor("VIOLET", 500);
const CAR_COLOR = getColor("ORANGE", 500);
const END_PAUSE_SECONDS = 0.9;
const MIN_TRAVEL_SECONDS = 4.8;
const TRAVEL_SECONDS_PER_METER = 0.56;

interface DisplacementDistanceLabProps {
  description: ReactNode;
  labels: {
    chooseCase: string;
    factLabels: {
      displacement: ReactNode;
      distance: ReactNode;
      meaning: ReactNode;
      vector: ReactNode;
    };
    meanings: Record<DisplacementDistanceCaseId, ReactNode>;
    modeLabels: Record<DisplacementDistanceCaseId, ReactNode>;
    viewLabel: string;
  };
  title: ReactNode;
}

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
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseCase}
          gridColumns="3"
          onValueChange={handleCaseChange}
          type="single"
          value={caseId}
          variant="outline"
        >
          {Arr.map(DISPLACEMENT_DISTANCE_CASE_IDS, (caseOption) => (
            <ToggleGroupItem key={caseOption} value={caseOption}>
              {labels.modeLabels[caseOption]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <VisualCardScene
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
          render={<section />}
        >
          <ThreeCanvas frameloop="always">
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
        </VisualCardScene>
      </VisualCardBody>

      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <VisualFactIndicator
            indicatorColor={ROUTE_COLOR}
            label={labels.factLabels.distance}
            value={
              <InlineMath math={`s=${formatMeterMath(motion.distance)}`} />
            }
          />
          <VisualFactIndicator
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
          <VisualFactIndicator
            label={labels.factLabels.vector}
            value={
              <InlineMath math={formatVectorMath(motion.displacementVector)} />
            }
          />
          <VisualFactIndicator
            label={labels.factLabels.meaning}
            value={labels.meanings[motion.caseId]}
          />
        </dl>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
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
      fov={43}
      framing="content"
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
    <CameraBounds
      motion={{
        rotation: "y",
        translation: {
          x: {
            min: Math.min(...Arr.map(motion.route, (point) => point.x)),
            max: Math.max(...Arr.map(motion.route, (point) => point.x)),
          },
          y: { min: 0.035, max: 0.035 },
          z: {
            min: Math.min(...Arr.map(motion.route, (point) => point.z)),
            max: Math.max(...Arr.map(motion.route, (point) => point.z)),
          },
        },
      }}
      objectRef={carRef}
    >
      <group scale={DISPLACEMENT_DISTANCE_SCENE.carScale}>
        <PhysicsCarModel
          bodyColor={CAR_COLOR}
          modelPath={DISPLACEMENT_DISTANCE_CAR_MODEL_PATH}
        />
      </group>
    </CameraBounds>
  );
}

function RouteRoad({ segments }: { segments: RouteSegment[] }) {
  return (
    <group>
      {Arr.map(segments, (segment) => (
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

      {Arr.map(stripePositions, (x) => (
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
  const routePoints = Arr.map(
    motion.route,
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
