import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type {
  AverageVelocitySpeedCaseId,
  AverageVelocitySpeedState,
  WorldPoint2,
} from "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/data";
import {
  AVERAGE_VELOCITY_SPEED_CAMERA,
  AVERAGE_VELOCITY_SPEED_COLORS,
  AVERAGE_VELOCITY_SPEED_SCENE,
  getAverageMotionRoutePoints,
  getAverageMotionRouteSample,
  toWorldPoint,
  toWorldRoutePoint,
} from "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/data";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef } from "react";
import type { Group } from "three";
import { CatmullRomCurve3, Quaternion, Vector3 } from "three";

const TRACK_Y = 0.18;
const PAD_Y = 0.015;
const PAUSE_SECONDS = 0.8;
const SAME_POINT_EPSILON = 0.001;
const STANCHION_COUNT = 8;
const UP_AXIS = new Vector3(0, 1, 0);
const BALL_Y =
  TRACK_Y +
  AVERAGE_VELOCITY_SPEED_SCENE.routeRadius +
  AVERAGE_VELOCITY_SPEED_SCENE.ballRadius;

/** The lights and the camera of the average-motion scene. The lab draws its motion as children. */
export function AverageMotionStage({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <CameraControls
        cameraPosition={AVERAGE_VELOCITY_SPEED_CAMERA.cameraPosition}
        cameraTarget={AVERAGE_VELOCITY_SPEED_CAMERA.cameraTarget}
        enablePan
        enableRotate
        enableZoom
        fov={AVERAGE_VELOCITY_SPEED_CAMERA.fov}
        framing="content"
      />
      {children}
    </Suspense>
  );
}

export function AverageMotionScene({
  motion,
}: {
  motion: AverageVelocitySpeedState;
}) {
  const track = useMemo(() => getTrackGeometry(motion), [motion]);

  return (
    <group>
      <TrackStanchions points={track.centerPoints} />
      <RouteTube
        color={AVERAGE_VELOCITY_SPEED_COLORS.route}
        metallic={false}
        points={track.centerPoints}
        radius={AVERAGE_VELOCITY_SPEED_SCENE.routeRadius}
      />
      <RouteTube
        color={AVERAGE_VELOCITY_SPEED_COLORS.rail}
        metallic
        points={track.leftRailPoints}
        radius={AVERAGE_VELOCITY_SPEED_SCENE.railRadius}
      />
      <RouteTube
        color={AVERAGE_VELOCITY_SPEED_COLORS.rail}
        metallic
        points={track.rightRailPoints}
        radius={AVERAGE_VELOCITY_SPEED_SCENE.railRadius}
      />
      <EndpointPads motion={motion} />
      <DisplacementGuide motion={motion} />
      <GhostBalls motion={motion} />
      <RollingBall motion={motion} />
    </group>
  );
}

/** Brushed-steel laboratory stanchions anchoring the roller track to the floor. */
function TrackStanchions({ points }: { points: readonly WorldPoint2[] }) {
  const supports = useMemo(() => {
    if (points.length < 2) {
      return [];
    }
    return Arr.map(Arr.range(0, STANCHION_COUNT - 1), (index) => {
      const i = Math.round(
        (index / (STANCHION_COUNT - 1)) * (points.length - 1)
      );
      return { id: `stanchion-${index}`, point: points[i] ?? points[0] };
    });
  }, [points]);

  return (
    <group>
      {Arr.map(supports, ({ id, point }) => (
        <group key={id} position={[point.x, 0, point.z]}>
          <mesh castShadow position={[0, TRACK_Y / 2, 0]} receiveShadow>
            <cylinderGeometry args={[0.022, 0.026, TRACK_Y, 16]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.34} />
          </mesh>
          <mesh castShadow position={[0, 0.012, 0]} receiveShadow>
            <cylinderGeometry args={[0.065, 0.075, 0.024, 24]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RouteTube({
  color,
  metallic,
  points,
  radius,
}: {
  color: string;
  metallic: boolean;
  points: readonly WorldPoint2[];
  radius: number;
}) {
  const curve = useMemo(() => {
    const vectors = Arr.map(
      points,
      (point) => new Vector3(point.x, TRACK_Y, point.z)
    );

    return new CatmullRomCurve3(vectors, false, "centripetal", 0.35);
  }, [points]);

  return (
    <mesh castShadow receiveShadow>
      <tubeGeometry args={[curve, points.length * 2, radius, 20, false]} />
      {metallic ? (
        <MetalMaterial color={color} roughness={0.32} />
      ) : (
        <meshPhysicalMaterial
          clearcoat={0.55}
          clearcoatRoughness={0.14}
          color={color}
          metalness={0.12}
          roughness={0.28}
        />
      )}
    </mesh>
  );
}

function EndpointPads({ motion }: { motion: AverageVelocitySpeedState }) {
  const start = toWorldPoint(motion.start);
  const end = toWorldPoint(motion.end);

  if (motion.displacement < SAME_POINT_EPSILON) {
    return (
      <RoutePad color={AVERAGE_VELOCITY_SPEED_COLORS.start} point={start} />
    );
  }

  return (
    <>
      <RoutePad color={AVERAGE_VELOCITY_SPEED_COLORS.start} point={start} />
      <RoutePad
        color={AVERAGE_VELOCITY_SPEED_COLORS.displacement}
        point={end}
      />
    </>
  );
}

function RoutePad({ color, point }: { color: string; point: WorldPoint2 }) {
  return (
    <group position={[point.x, PAD_Y, point.z]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.37, 0.03, 40]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.017, 0]} receiveShadow>
        <cylinderGeometry args={[0.29, 0.29, 0.008, 40]} />
        <meshPhysicalMaterial clearcoat={0.6} color={color} roughness={0.3} />
      </mesh>
    </group>
  );
}

function DisplacementGuide({ motion }: { motion: AverageVelocitySpeedState }) {
  const start = toWorldPoint(motion.start);
  const end = toWorldPoint(motion.end);
  const guideY = TRACK_Y + 0.18;

  const arrow = useMemo(() => {
    const from = new Vector3(start.x, guideY, start.z);
    const to = new Vector3(end.x, guideY, end.z);
    const dir = new Vector3().subVectors(to, from);
    const span = dir.length();
    if (span < SAME_POINT_EPSILON) {
      return null;
    }
    dir.normalize();
    const headLen = Math.min(0.28, span * 0.25);
    const shaftEnd = to.clone().addScaledVector(dir, -headLen);
    const headPos = to.clone().addScaledVector(dir, -headLen / 2);
    const quaternion = new Quaternion().setFromUnitVectors(UP_AXIS, dir);
    return { from, headLen, headPos, quaternion, shaftEnd };
  }, [end.x, end.z, guideY, start.x, start.z]);

  if (motion.displacement < SAME_POINT_EPSILON || arrow === null) {
    return (
      <mesh position={[start.x, BALL_Y + 0.04, start.z]}>
        <sphereGeometry args={[0.14, 28, 20]} />
        <meshPhysicalMaterial
          clearcoat={0.8}
          color={AVERAGE_VELOCITY_SPEED_COLORS.displacement}
          depthWrite={false}
          opacity={0.76}
          roughness={0.18}
          transparent
        />
      </mesh>
    );
  }

  return (
    <group>
      <Line
        color={AVERAGE_VELOCITY_SPEED_COLORS.displacement}
        dashed
        dashSize={0.16}
        gapSize={0.1}
        lineWidth={3.5}
        points={[arrow.from, arrow.shaftEnd]}
        toneMapped={false}
        transparent
      />
      <mesh castShadow position={arrow.headPos} quaternion={arrow.quaternion}>
        <coneGeometry args={[0.075, arrow.headLen, 24]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          color={AVERAGE_VELOCITY_SPEED_COLORS.displacement}
          emissive={AVERAGE_VELOCITY_SPEED_COLORS.displacement}
          emissiveIntensity={0.22}
          roughness={0.24}
        />
      </mesh>
    </group>
  );
}

function GhostBalls({ motion }: { motion: AverageVelocitySpeedState }) {
  return (
    <group>
      {Array.from(
        { length: AVERAGE_VELOCITY_SPEED_SCENE.ghostCount },
        (_, index) => {
          const elapsed =
            (motion.duration * index) /
            (AVERAGE_VELOCITY_SPEED_SCENE.ghostCount - 1);
          const sample = getAverageMotionRouteSample(motion, elapsed);
          const point = toWorldRoutePoint(sample);

          return (
            <group key={elapsed} position={[point.x, BALL_Y, point.z]}>
              <mesh scale={0.78 + index * 0.03}>
                <sphereGeometry args={[0.14, 24, 16]} />
                <meshPhysicalMaterial
                  clearcoat={1}
                  clearcoatRoughness={0.08}
                  color={AVERAGE_VELOCITY_SPEED_COLORS.distance}
                  depthWrite={false}
                  opacity={0.34}
                  roughness={0.14}
                  transparent
                />
              </mesh>
              <mesh scale={0.38}>
                <sphereGeometry args={[0.14, 20, 14]} />
                <meshStandardMaterial
                  color={AVERAGE_VELOCITY_SPEED_COLORS.distance}
                  emissive={AVERAGE_VELOCITY_SPEED_COLORS.distance}
                  emissiveIntensity={0.35}
                  roughness={0.25}
                />
              </mesh>
            </group>
          );
        }
      )}
    </group>
  );
}

function RollingBall({ motion }: { motion: AverageVelocitySpeedState }) {
  const groupRef = useRef<Group>(null);
  const ballRef = useRef<Group>(null);
  const { advance, time: simTime } = useSimulationClock(0);
  const caseRef = useRef<AverageVelocitySpeedCaseId>(motion.caseId);

  useFrame((_, delta) => {
    if (!(groupRef.current && ballRef.current)) {
      return;
    }

    if (caseRef.current !== motion.caseId) {
      caseRef.current = motion.caseId;
      simTime.current = 0;
    }

    const loopSeconds = motion.duration + PAUSE_SECONDS;
    const elapsed = advance(delta) % loopSeconds;
    const sample = getAverageMotionRouteSample(
      motion,
      Math.min(elapsed, motion.duration)
    );
    const point = toWorldRoutePoint(sample);
    const traveledWorld =
      sample.traveledDistance * AVERAGE_VELOCITY_SPEED_SCENE.worldScale;

    groupRef.current.position.set(point.x, BALL_Y, point.z);
    groupRef.current.rotation.y = -sample.heading;
    ballRef.current.rotation.z =
      -traveledWorld / AVERAGE_VELOCITY_SPEED_SCENE.ballRadius;
  });

  const route = getAverageMotionRoutePoints(motion);

  return (
    <CameraBounds
      motion={{
        rotation: "y",
        translation: {
          x: {
            min: Math.min(...Arr.map(route, (point) => point.x)),
            max: Math.max(...Arr.map(route, (point) => point.x)),
          },
          y: { min: BALL_Y, max: BALL_Y },
          z: {
            min: Math.min(...Arr.map(route, (point) => point.z)),
            max: Math.max(...Arr.map(route, (point) => point.z)),
          },
        },
      }}
      objectRef={groupRef}
    >
      <CameraBounds motion={{ rotation: "z" }} objectRef={ballRef}>
        <mesh castShadow receiveShadow>
          <sphereGeometry
            args={[AVERAGE_VELOCITY_SPEED_SCENE.ballRadius, 40, 28]}
          />
          <meshPhysicalMaterial
            clearcoat={0.9}
            clearcoatRoughness={0.08}
            color={AVERAGE_VELOCITY_SPEED_COLORS.ball}
            metalness={0.08}
            roughness={0.18}
          />
        </mesh>
        <BallBand rotation={[Math.PI / 2, 0, 0]} />
        <BallBand rotation={[0, Math.PI / 2, 0]} />
      </CameraBounds>
    </CameraBounds>
  );
}

function BallBand({
  rotation,
}: {
  rotation: readonly [number, number, number];
}) {
  return (
    <mesh rotation={rotation}>
      <torusGeometry
        args={[
          AVERAGE_VELOCITY_SPEED_SCENE.ballRadius * 1.015,
          AVERAGE_VELOCITY_SPEED_SCENE.ballRadius * 0.032,
          12,
          56,
        ]}
      />
      <MetalMaterial
        color={AVERAGE_VELOCITY_SPEED_COLORS.ballBand}
        roughness={0.28}
      />
    </mesh>
  );
}

function getTrackGeometry(motion: AverageVelocitySpeedState) {
  const railOffset = AVERAGE_VELOCITY_SPEED_SCENE.railOffset;
  const centerPoints = getAverageMotionRoutePoints(motion);
  const leftRailPoints = getAverageMotionRoutePoints(motion, railOffset);
  const rightRailPoints = getAverageMotionRoutePoints(motion, -railOffset);

  return {
    centerPoints,
    leftRailPoints,
    rightRailPoints,
  };
}
