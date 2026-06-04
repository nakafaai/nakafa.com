"use client";

import { useFrame } from "@react-three/fiber";
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
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import { CatmullRomCurve3, type Group, Vector3 } from "three";

const ANGLES = [30, 45, 60] as const;
const GRAVITY = 10;
const INITIAL_SPEED = 20;
const PAUSE_SECONDS = 0.9;
const WORLD_SCALE = 0.16;
const CAMERA_POSITION = [3.8, 3, 5.8] as const;
const CAMERA_TARGET = [0, 0.7, 0] as const;
const TRAILING_ZERO_PATTERN = /\.0$/;

type LaunchAngle = (typeof ANGLES)[number];
type Locale = "id" | "en";

const COPY = {
  id: {
    angle: "Sudut awal",
    description:
      "Ubah sudut awal untuk melihat bola mendarat pada jarak dan tinggi puncak yang berbeda.",
    maxHeight: "Tinggi puncak",
    range: "Jangkauan",
    speed: "Kelajuan awal",
    title: "Lintasan Bola Parabola",
  },
  en: {
    angle: "Launch angle",
    description:
      "Change the launch angle to see the ball land at a different range and peak height.",
    maxHeight: "Peak height",
    range: "Range",
    speed: "Initial speed",
    title: "Projectile Ball Path",
  },
} as const;

interface ParabolicMovementLabProps {
  locale: Locale;
}

export function ParabolicMovementLab({ locale }: ParabolicMovementLabProps) {
  const [angle, setAngle] = useState<LaunchAngle>(45);
  const labels = COPY[locale];
  const motion = useMemo(() => getMotion(angle), [angle]);

  function handleAngleChange(value: string) {
    if (!value) {
      return;
    }

    const nextAngle = Number(value);

    if (!isLaunchAngle(nextAngle)) {
      return;
    }

    setAngle(nextAngle);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.angle}
          gridColumns="3"
          onValueChange={handleAngleChange}
          type="single"
          value={String(angle)}
          variant="outline"
        >
          {ANGLES.map((angleOption) => (
            <ToggleGroupItem key={angleOption} value={String(angleOption)}>
              <InlineMath math={`\\theta=${angleOption}^\\circ`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.title}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{ fov: 43, position: CAMERA_POSITION }}
            frameloop="always"
          >
            <Suspense>
              <ambientLight intensity={0.72} />
              <hemisphereLight
                color={getColor("SLATE", 50)}
                groundColor={getColor("SLATE", 600)}
                intensity={0.62}
              />
              <directionalLight
                castShadow
                intensity={1.3}
                position={[4.5, 5.6, 4]}
                shadow-bias={-0.0005}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
              />
              <CameraControls
                autoRotate={false}
                cameraPosition={CAMERA_POSITION}
                cameraTarget={CAMERA_TARGET}
                enablePan
                enableRotate
                enableZoom
                minDistance={3}
              />
              <ParabolicScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-2 gap-4 text-sm lg:grid-cols-4">
          <LabFact
            label={labels.angle}
            value={<InlineMath math={`\\theta=${motion.angle}^\\circ`} />}
          />
          <LabFact
            label={labels.speed}
            value={<InlineMath math={`${INITIAL_SPEED}\\text{ m/s}`} />}
          />
          <LabFact
            label={labels.range}
            value={<InlineMath math={formatMeter(motion.range, locale)} />}
          />
          <LabFact
            label={labels.maxHeight}
            value={<InlineMath math={formatMeter(motion.maxHeight, locale)} />}
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

function ParabolicScene({ motion }: { motion: MotionState }) {
  const landingSurfaceWidth = motion.rangeWorld + 1.2;

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[landingSurfaceWidth, 1.6]} />
        <meshStandardMaterial
          color={getColor("EMERALD", 100)}
          roughness={0.8}
        />
      </mesh>
      <Trajectory motion={motion} />
      <mesh
        position={[motion.rangeWorld / 2, 0.035, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.24, 0.025, 12, 40]} />
        <meshStandardMaterial color={getColor("TEAL")} roughness={0.55} />
      </mesh>
      <ProjectileBall motion={motion} />
    </group>
  );
}

function Trajectory({ motion }: { motion: MotionState }) {
  const curve = useMemo(() => {
    const points = Array.from({ length: 36 }, (_, index) => {
      const progress = index / 35;
      const point = getProjectilePoint(motion, progress);

      return new Vector3(point.x, point.y + 0.18, 0);
    });

    return new CatmullRomCurve3(points);
  }, [motion]);

  return (
    <mesh>
      <tubeGeometry args={[curve, 48, 0.018, 8, false]} />
      <meshStandardMaterial color={getColor("ORANGE", 500)} roughness={0.48} />
    </mesh>
  );
}

function ProjectileBall({ motion }: { motion: MotionState }) {
  const groupRef = useRef<Group>(null);
  const animationStartRef = useRef<number | null>(null);
  const animationAngleRef = useRef<LaunchAngle | null>(null);

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    if (
      animationStartRef.current === null ||
      animationAngleRef.current !== motion.angle
    ) {
      animationAngleRef.current = motion.angle;
      animationStartRef.current = state.clock.elapsedTime;
    }

    const loopSeconds = motion.flightTime + PAUSE_SECONDS;
    const elapsed =
      (state.clock.elapsedTime - animationStartRef.current) % loopSeconds;
    const progress = Math.min(elapsed / motion.flightTime, 1);
    const point = getProjectilePoint(motion, progress);

    groupRef.current.position.set(point.x, point.y + 0.18, 0);
    groupRef.current.rotation.z = -progress * Math.PI * 4;
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshStandardMaterial color={getColor("BLUE")} roughness={0.36} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.183, 0.008, 8, 32]} />
        <meshStandardMaterial color={getColor("BLUE", 200)} roughness={0.42} />
      </mesh>
    </group>
  );
}

function LabFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

interface MotionState {
  angle: LaunchAngle;
  flightTime: number;
  horizontalSpeed: number;
  maxHeight: number;
  range: number;
  rangeWorld: number;
  verticalSpeed: number;
}

function getMotion(angle: LaunchAngle): MotionState {
  const radians = (angle * Math.PI) / 180;
  const horizontalSpeed = INITIAL_SPEED * Math.cos(radians);
  const verticalSpeed = INITIAL_SPEED * Math.sin(radians);
  const flightTime = (2 * verticalSpeed) / GRAVITY;
  const range = horizontalSpeed * flightTime;
  const maxHeight = verticalSpeed ** 2 / (2 * GRAVITY);

  return {
    angle,
    flightTime,
    horizontalSpeed,
    maxHeight,
    range,
    rangeWorld: range * WORLD_SCALE,
    verticalSpeed,
  };
}

function getProjectilePoint(motion: MotionState, progress: number) {
  const time = motion.flightTime * Math.min(Math.max(progress, 0), 1);
  const x = motion.horizontalSpeed * time;
  const y = motion.verticalSpeed * time - (GRAVITY * time ** 2) / 2;

  return {
    x: (x - motion.range / 2) * WORLD_SCALE,
    y: y * WORLD_SCALE,
  };
}

function isLaunchAngle(value: number): value is LaunchAngle {
  return ANGLES.some((angle) => angle === value);
}

function formatMeter(value: number, locale: Locale) {
  const rounded = value.toFixed(1).replace(TRAILING_ZERO_PATTERN, "");

  if (locale === "id") {
    return `${rounded.replace(".", "{,}")}\\text{ m}`;
  }

  return `${rounded}\\text{ m}`;
}
