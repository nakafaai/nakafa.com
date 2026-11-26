import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car";
import type {
  DisplacementDistanceCaseId,
  DisplacementDistanceState,
} from "@repo/design-system/components/contents/physics/kinematics/displacement-distance/data";
import {
  DISPLACEMENT_DISTANCE_CAR_MODEL_PATH,
  DISPLACEMENT_DISTANCE_CASE_IDS,
  DISPLACEMENT_DISTANCE_SCENE,
  formatVectorMath,
  getDisplacementDistanceState,
  getDisplacementDistanceView,
  getRouteSampleAtProgress,
  isDisplacementDistanceCaseId,
} from "@repo/design-system/components/contents/physics/kinematics/displacement-distance/data";
import { formatKeptZeroMeterMath } from "@repo/design-system/components/contents/physics/kinematics/math";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Route } from "@repo/design-system/components/three/stage/route";
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
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { Vector3 } from "three";

const ROUTE_COLOR = PLOT_COLORS.teal;
const DISPLACEMENT_COLOR = PLOT_COLORS.violet;
const CAR_COLOR = PLOT_COLORS.orange;
/** The height of the road the car drives on. */
const ROAD_Y = 0.02;
const END_PAUSE_SECONDS = 0.9;
const MIN_TRAVEL_SECONDS = 4.8;
const TRAVEL_SECONDS_PER_METER = 0.56;

interface DisplacementDistanceLabProps {
  description: NonNullable<ReactNode>;
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
  title: NonNullable<ReactNode>;
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

      <VisualCardToolbar>
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
          setting="field"
        >
          <Suspense>
            <DisplacementDistanceCamera view={view} />
            <DisplacementDistanceScene motion={motion} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={ROUTE_COLOR}
            label={labels.factLabels.distance}
            value={
              <InlineMath
                math={`s=${formatKeptZeroMeterMath(motion.distance)}`}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={DISPLACEMENT_COLOR}
            label={labels.factLabels.displacement}
            value={
              <InlineMath
                math={`|\\Delta\\vec{r}|=${formatKeptZeroMeterMath(
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
        </VisualCardFacts>
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
  const places = useMemo(
    () => Arr.map(motion.route, (point) => [point.x, point.z] as const),
    [motion.route]
  );

  return (
    <group>
      <Route
        dash={DISPLACEMENT_DISTANCE_SCENE.stripeLength}
        places={places}
        spacing={DISPLACEMENT_DISTANCE_SCENE.stripeSpacing}
        width={DISPLACEMENT_DISTANCE_SCENE.roadWidth}
      />
      <RouteLines motion={motion} />
      <StartEndMarkers motion={motion} />
      <AnimatedCar motion={motion} />
    </group>
  );
}

function AnimatedCar({ motion }: { motion: DisplacementDistanceState }) {
  const carRef = useRef<Group>(null);
  const { advance, time: simTime } = useSimulationClock(0);
  const animationCaseRef = useRef<DisplacementDistanceCaseId>(motion.caseId);

  useFrame((_, delta) => {
    if (!carRef.current) {
      return;
    }

    if (animationCaseRef.current !== motion.caseId) {
      animationCaseRef.current = motion.caseId;
      simTime.current = 0;
    }

    const elapsed = advance(delta);
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

function RouteLines({ motion }: { motion: DisplacementDistanceState }) {
  const routePoints = Arr.map(
    motion.route,
    (point) =>
      new Vector3(point.x, DISPLACEMENT_DISTANCE_SCENE.routeLineY, point.z)
  );

  return (
    <>
      <Line
        color={ROUTE_COLOR}
        lineWidth={4}
        points={routePoints}
        toneMapped={false}
      />
      {motion.displacement > 0 ? (
        <ArrowHelper
          arrowSize={0.44}
          color={DISPLACEMENT_COLOR}
          from={[
            motion.start.x,
            DISPLACEMENT_DISTANCE_SCENE.displacementLineY + 0.04,
            motion.start.z,
          ]}
          lineWidth={4}
          to={[
            motion.end.x,
            DISPLACEMENT_DISTANCE_SCENE.displacementLineY + 0.04,
            motion.end.z,
          ]}
        />
      ) : null}
    </>
  );
}

function StartEndMarkers({ motion }: { motion: DisplacementDistanceState }) {
  return (
    <>
      {/* Grounded start survey marker */}
      <group position={[motion.start.x, ROAD_Y, motion.start.z]}>
        <mesh castShadow position={[0, 0.025, 0]} receiveShadow>
          <cylinderGeometry args={[0.18, 0.21, 0.05, 24]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.38} />
        </mesh>
        <mesh castShadow position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.024, 0.028, 0.36, 16]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
        </mesh>
        <mesh castShadow position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.085, 24, 18]} />
          <meshPhysicalMaterial
            clearcoat={0.85}
            color={ROUTE_COLOR}
            emissive={ROUTE_COLOR}
            emissiveIntensity={0.25}
            roughness={0.2}
          />
        </mesh>
      </group>
      {/* Grounded finish checkpoint pennant */}
      <group position={[motion.end.x, ROAD_Y, motion.end.z]}>
        <mesh castShadow position={[0, 0.025, 0]} receiveShadow>
          <cylinderGeometry args={[0.18, 0.21, 0.05, 24]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.38} />
        </mesh>
        <mesh castShadow position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.022, 0.026, 0.64, 16]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
        </mesh>
        <mesh castShadow position={[0.14, 0.56, 0]}>
          <boxGeometry args={[0.26, 0.16, 0.018]} />
          <meshStandardMaterial color={CAR_COLOR} roughness={0.44} />
        </mesh>
        <mesh castShadow position={[0, 0.68, 0]}>
          <sphereGeometry args={[0.036, 16, 12]} />
          <MetalMaterial color={PLOT_COLORS.amber} roughness={0.22} />
        </mesh>
      </group>
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
