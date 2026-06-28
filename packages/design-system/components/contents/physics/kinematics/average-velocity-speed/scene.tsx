"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  AVERAGE_VELOCITY_SPEED_CAMERA,
  AVERAGE_VELOCITY_SPEED_COLORS,
  AVERAGE_VELOCITY_SPEED_SCENE,
  type AverageVelocitySpeedCaseId,
  type AverageVelocitySpeedState,
  getAverageMotionRoutePoints,
  getAverageMotionRouteSample,
  toWorldPoint,
  toWorldRoutePoint,
  type WorldPoint2,
} from "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/data";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { getColor } from "@repo/design-system/lib/color";
import { Suspense, useMemo, useRef } from "react";
import { CatmullRomCurve3, type Group, Vector3 } from "three";

const TRACK_Y = 0.18;
const PAD_Y = 0.06;
const PLATFORM_HEIGHT = 0.16;
const PLATFORM_PADDING = 0.78;
const EDGE_THICKNESS = 0.12;
const EDGE_HEIGHT = 0.16;
const PAUSE_SECONDS = 0.8;
const SAME_POINT_EPSILON = 0.001;
const BALL_Y =
  TRACK_Y +
  AVERAGE_VELOCITY_SPEED_SCENE.routeRadius +
  AVERAGE_VELOCITY_SPEED_SCENE.ballRadius;

interface PlatformBounds {
  centerX: number;
  centerZ: number;
  depth: number;
  width: number;
}

export function AverageMotionStage({
  motion,
}: {
  motion: AverageVelocitySpeedState;
}) {
  return (
    <Suspense>
      <ambientLight intensity={0.72} />
      <hemisphereLight
        color={getColor("SLATE", 50)}
        groundColor={getColor("STONE", 600)}
        intensity={0.72}
      />
      <directionalLight
        castShadow
        intensity={1.34}
        position={[4.8, 6.4, 4.6]}
        shadow-bias={-0.0006}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
        shadow-normalBias={0.02}
      />
      <CameraControls
        autoRotate={false}
        cameraPosition={AVERAGE_VELOCITY_SPEED_CAMERA.cameraPosition}
        cameraTarget={AVERAGE_VELOCITY_SPEED_CAMERA.cameraTarget}
        enablePan
        enableRotate
        enableZoom
        fov={AVERAGE_VELOCITY_SPEED_CAMERA.fov}
        maxDistance={AVERAGE_VELOCITY_SPEED_CAMERA.maxDistance}
        minDistance={AVERAGE_VELOCITY_SPEED_CAMERA.minDistance}
      />
      <AverageMotionScene motion={motion} />
    </Suspense>
  );
}

function AverageMotionScene({ motion }: { motion: AverageVelocitySpeedState }) {
  const track = useMemo(() => getTrackGeometry(motion), [motion]);

  return (
    <group>
      <MotionPlatform bounds={track.platformBounds} />
      <RouteTube
        color={AVERAGE_VELOCITY_SPEED_COLORS.route}
        points={track.centerPoints}
        radius={AVERAGE_VELOCITY_SPEED_SCENE.routeRadius}
      />
      <RouteTube
        color={AVERAGE_VELOCITY_SPEED_COLORS.rail}
        points={track.leftRailPoints}
        radius={AVERAGE_VELOCITY_SPEED_SCENE.railRadius}
      />
      <RouteTube
        color={AVERAGE_VELOCITY_SPEED_COLORS.rail}
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

function MotionPlatform({ bounds }: { bounds: PlatformBounds }) {
  const topY = -PLATFORM_HEIGHT / 2;
  const edgeY = PAD_Y + EDGE_HEIGHT / 2;

  return (
    <group>
      <mesh position={[bounds.centerX, topY, bounds.centerZ]} receiveShadow>
        <boxGeometry args={[bounds.width, PLATFORM_HEIGHT, bounds.depth]} />
        <meshStandardMaterial
          color={AVERAGE_VELOCITY_SPEED_COLORS.platform}
          roughness={0.82}
        />
      </mesh>
      <mesh
        castShadow
        position={[
          bounds.centerX,
          edgeY,
          bounds.centerZ + bounds.depth / 2 - EDGE_THICKNESS / 2,
        ]}
        receiveShadow
      >
        <boxGeometry args={[bounds.width, EDGE_HEIGHT, EDGE_THICKNESS]} />
        <meshStandardMaterial
          color={AVERAGE_VELOCITY_SPEED_COLORS.platformEdge}
          roughness={0.72}
        />
      </mesh>
      <mesh
        castShadow
        position={[
          bounds.centerX,
          edgeY,
          bounds.centerZ - bounds.depth / 2 + EDGE_THICKNESS / 2,
        ]}
        receiveShadow
      >
        <boxGeometry args={[bounds.width, EDGE_HEIGHT, EDGE_THICKNESS]} />
        <meshStandardMaterial
          color={AVERAGE_VELOCITY_SPEED_COLORS.platformEdge}
          roughness={0.72}
        />
      </mesh>
      <mesh
        castShadow
        position={[
          bounds.centerX + bounds.width / 2 - EDGE_THICKNESS / 2,
          edgeY,
          bounds.centerZ,
        ]}
        receiveShadow
      >
        <boxGeometry args={[EDGE_THICKNESS, EDGE_HEIGHT, bounds.depth]} />
        <meshStandardMaterial
          color={AVERAGE_VELOCITY_SPEED_COLORS.platformEdge}
          roughness={0.72}
        />
      </mesh>
      <mesh
        castShadow
        position={[
          bounds.centerX - bounds.width / 2 + EDGE_THICKNESS / 2,
          edgeY,
          bounds.centerZ,
        ]}
        receiveShadow
      >
        <boxGeometry args={[EDGE_THICKNESS, EDGE_HEIGHT, bounds.depth]} />
        <meshStandardMaterial
          color={AVERAGE_VELOCITY_SPEED_COLORS.platformEdge}
          roughness={0.72}
        />
      </mesh>
    </group>
  );
}

function RouteTube({
  color,
  points,
  radius,
}: {
  color: string;
  points: readonly WorldPoint2[];
  radius: number;
}) {
  const curve = useMemo(() => {
    const vectors = points.map(
      (point) => new Vector3(point.x, TRACK_Y, point.z)
    );

    return new CatmullRomCurve3(vectors, false, "centripetal", 0.35);
  }, [points]);

  return (
    <mesh castShadow receiveShadow>
      <tubeGeometry args={[curve, points.length * 2, radius, 16, false]} />
      <meshStandardMaterial color={color} metalness={0.1} roughness={0.48} />
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
    <mesh position={[point.x, PAD_Y, point.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.28, 0.36, 36]} />
      <meshStandardMaterial color={color} roughness={0.56} />
    </mesh>
  );
}

function DisplacementGuide({ motion }: { motion: AverageVelocitySpeedState }) {
  const start = toWorldPoint(motion.start);
  const end = toWorldPoint(motion.end);

  if (motion.displacement < SAME_POINT_EPSILON) {
    return (
      <mesh position={[start.x, BALL_Y + 0.04, start.z]}>
        <sphereGeometry args={[0.16, 24, 16]} />
        <meshBasicMaterial
          color={AVERAGE_VELOCITY_SPEED_COLORS.displacement}
          depthWrite={false}
          opacity={0.82}
          transparent
        />
      </mesh>
    );
  }

  return (
    <Line
      color={AVERAGE_VELOCITY_SPEED_COLORS.displacement}
      dashed
      dashSize={0.16}
      gapSize={0.1}
      lineWidth={3}
      points={[
        [start.x, TRACK_Y + 0.16, start.z],
        [end.x, TRACK_Y + 0.16, end.z],
      ]}
      transparent
    />
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
              <mesh scale={1 + index * 0.03}>
                <sphereGeometry args={[0.17, 18, 12]} />
                <meshBasicMaterial
                  color={AVERAGE_VELOCITY_SPEED_COLORS.ghost}
                  depthWrite={false}
                  opacity={0.3}
                  transparent
                />
              </mesh>
              <mesh scale={0.42}>
                <sphereGeometry args={[0.17, 16, 10]} />
                <meshBasicMaterial
                  color={AVERAGE_VELOCITY_SPEED_COLORS.distance}
                  depthWrite={false}
                  opacity={0.95}
                  transparent
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
  const startRef = useRef<number | null>(null);
  const caseRef = useRef<AverageVelocitySpeedCaseId | null>(null);

  useFrame(({ clock }) => {
    if (!(groupRef.current && ballRef.current)) {
      return;
    }

    if (startRef.current === null || caseRef.current !== motion.caseId) {
      startRef.current = clock.elapsedTime;
      caseRef.current = motion.caseId;
    }

    const loopSeconds = motion.duration + PAUSE_SECONDS;
    const elapsed = (clock.elapsedTime - startRef.current) % loopSeconds;
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

  return (
    <group ref={groupRef}>
      <group ref={ballRef}>
        <mesh castShadow receiveShadow>
          <sphereGeometry
            args={[AVERAGE_VELOCITY_SPEED_SCENE.ballRadius, 32, 24]}
          />
          <meshStandardMaterial
            color={AVERAGE_VELOCITY_SPEED_COLORS.ball}
            metalness={0.08}
            roughness={0.34}
          />
        </mesh>
        <BallBand rotation={[Math.PI / 2, 0, 0]} />
        <BallBand rotation={[0, Math.PI / 2, 0]} />
      </group>
    </group>
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
          AVERAGE_VELOCITY_SPEED_SCENE.ballRadius * 1.02,
          AVERAGE_VELOCITY_SPEED_SCENE.ballRadius * 0.028,
          8,
          48,
        ]}
      />
      <meshStandardMaterial
        color={AVERAGE_VELOCITY_SPEED_COLORS.ballBand}
        roughness={0.42}
      />
    </mesh>
  );
}

function getTrackGeometry(motion: AverageVelocitySpeedState) {
  const railOffset = AVERAGE_VELOCITY_SPEED_SCENE.railOffset;
  const centerPoints = getAverageMotionRoutePoints(motion);
  const leftRailPoints = getAverageMotionRoutePoints(motion, railOffset);
  const rightRailPoints = getAverageMotionRoutePoints(motion, -railOffset);
  const platformBounds = getPlatformBounds([
    ...centerPoints,
    ...leftRailPoints,
    ...rightRailPoints,
  ]);

  return {
    centerPoints,
    leftRailPoints,
    platformBounds,
    rightRailPoints,
  };
}

function getPlatformBounds(points: readonly WorldPoint2[]): PlatformBounds {
  const bounds = points.reduce(
    (nextBounds, point) => ({
      maxX: Math.max(nextBounds.maxX, point.x),
      maxZ: Math.max(nextBounds.maxZ, point.z),
      minX: Math.min(nextBounds.minX, point.x),
      minZ: Math.min(nextBounds.minZ, point.z),
    }),
    {
      maxX: Number.NEGATIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
      minX: Number.POSITIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
    }
  );
  const width = bounds.maxX - bounds.minX + PLATFORM_PADDING * 2;
  const depth = bounds.maxZ - bounds.minZ + PLATFORM_PADDING * 2;

  return {
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerZ: (bounds.minZ + bounds.maxZ) / 2,
    depth,
    width,
  };
}
