"use client";

import { RoundedBox } from "@react-three/drei";
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
import { Slider } from "@repo/design-system/components/ui/slider";
import { useTheme } from "next-themes";
import type { ReactNode, RefObject } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

const MIN_WIND_SPEED = 3;
const MAX_WIND_SPEED = 12;
const DEFAULT_WIND_SPEED = 7;
const WIND_GUST_COUNT = 72;
const WIND_GUSTS = Array.from({ length: WIND_GUST_COUNT }, (_, index) => ({
  id: `wind-gust-${index}`,
  index,
}));

interface WindConversionLabels {
  flow: ReactNode;
  flowLabel: string;
  meaning: ReactNode;
  meaningLabel: string;
  speedControl: string;
  speedUnit: string;
  viewLabel: string;
}

interface WindEnergyConversionLabProps {
  description: ReactNode;
  labels: WindConversionLabels;
  title: ReactNode;
}

/**
 * Shows wind energy conversion as one interactive 3D system: moving air turns a
 * rotor, the nacelle houses the generator, and the cable carries electricity.
 */
export function WindEnergyConversionLab({
  description,
  labels,
  title,
}: WindEnergyConversionLabProps) {
  const [windSpeed, setWindSpeed] = useState(DEFAULT_WIND_SPEED);
  const { resolvedTheme } = useTheme();
  const colors = getWindSceneColors(resolvedTheme);

  function handleSpeedChange(nextValue: number) {
    setWindSpeed(nextValue);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <section
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{ fov: 34, position: [1.9, 1.5, 3.45] }}
            frameloop="always"
          >
            <Suspense>
              <CameraControls
                autoRotate={false}
                cameraPosition={[1.9, 1.5, 3.45]}
                cameraTarget={[0.03, 0.72, 0.14]}
                maxDistance={6}
                minDistance={1.8}
              />
              <ambientLight intensity={0.68} />
              <hemisphereLight
                color={colors.skyLight}
                groundColor={colors.groundLight}
                intensity={0.62}
              />
              <directionalLight
                castShadow
                intensity={1.35}
                position={[4, 6, 4]}
                shadow-bias={-0.0006}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <WindConversionScene colors={colors} windSpeed={windSpeed} />
            </Suspense>
          </ThreeCanvas>
        </section>

        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.speedControl}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={`${windSpeed}\\ \\text{${labels.speedUnit}}`} />
            </span>
          </div>
          <Slider
            aria-label={labels.speedControl}
            max={MAX_WIND_SPEED}
            min={MIN_WIND_SPEED}
            onValueChange={handleSpeedChange}
            step={1}
            value={windSpeed}
          />
        </div>
      </CardContent>
      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <WindFact label={labels.flowLabel} value={labels.flow} />
          <WindFact label={labels.meaningLabel} value={labels.meaning} />
        </dl>
      </CardFooter>
    </Card>
  );
}

function WindConversionScene({
  colors,
  windSpeed,
}: {
  colors: ReturnType<typeof getWindSceneColors>;
  windSpeed: number;
}) {
  const rotorRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!rotorRef.current) {
      return;
    }

    rotorRef.current.rotation.z -= delta * windSpeed * 1.05;
  });

  return (
    <group position={[0, -0.02, 0]} scale={1.18}>
      <WindGustField color={colors.wind} windSpeed={windSpeed} />
      <WindTurbine colors={colors} rotorRef={rotorRef} />
    </group>
  );
}

function WindGustField({
  color,
  windSpeed,
}: {
  color: string;
  windSpeed: number;
}) {
  return (
    <group>
      {WIND_GUSTS.map((gust) => (
        <WindGust
          color={color}
          index={gust.index}
          key={gust.id}
          windSpeed={windSpeed}
        />
      ))}
    </group>
  );
}

function WindGust({
  color,
  index,
  windSpeed,
}: {
  color: string;
  index: number;
  windSpeed: number;
}) {
  const ref = useRef<Group>(null);
  const seed = useMemo(() => {
    const column = index % 9;
    const row = Math.floor(index / 9) % 8;

    return {
      baseX: (column - 4) * 0.07 + Math.sin(index * 1.7) * 0.018,
      baseY: 1.2 + (row - 3.5) * 0.11 + Math.cos(index * 1.1) * 0.028,
      phase: (index * 0.137) % 1,
      size: 0.72 + ((index * 17) % 7) * 0.045,
      spin: index % 2 === 0 ? 1 : -1,
    };
  }, [index]);

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    const speed = 0.18 + windSpeed * 0.035;
    const progress = (state.clock.elapsedTime * speed + seed.phase) % 1;
    const wakeProgress = Math.max(0, (progress - 0.58) / 0.42);
    const swirl =
      Math.sin(wakeProgress * Math.PI * 2.4 + index * 0.73) *
      wakeProgress *
      0.16;
    const lift =
      Math.cos(wakeProgress * Math.PI * 1.8 + index) * wakeProgress * 0.08;

    ref.current.position.x = seed.baseX + swirl;
    ref.current.position.y = seed.baseY + lift;
    ref.current.position.z = 1.42 - progress * 1.85;
    ref.current.rotation.set(
      Math.PI / 2 + wakeProgress * 0.34,
      seed.spin * (0.34 + wakeProgress * 0.55),
      seed.spin * 0.2 + swirl * 2.1
    );
    ref.current.scale.set(
      seed.size * 0.42,
      seed.size * (0.16 - wakeProgress * 0.04),
      seed.size * 0.7
    );
  });

  return (
    <group ref={ref}>
      <mesh>
        <icosahedronGeometry args={[0.08, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.12}
          opacity={0.22}
          roughness={0.5}
          transparent
        />
      </mesh>
    </group>
  );
}

function WindTurbine({
  colors,
  rotorRef,
}: {
  colors: ReturnType<typeof getWindSceneColors>;
  rotorRef: RefObject<Group | null>;
}) {
  return (
    <group>
      <mesh castShadow position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.065, 0.12, 1.62, 36]} />
        <meshStandardMaterial
          color={colors.tower}
          metalness={0.18}
          roughness={0.42}
        />
      </mesh>
      <mesh castShadow position={[0, -0.42, 0]} receiveShadow>
        <cylinderGeometry args={[0.24, 0.34, 0.18, 40]} />
        <meshStandardMaterial color={colors.foundation} roughness={0.52} />
      </mesh>
      <RoundedBox
        args={[0.74, 0.3, 0.38]}
        castShadow
        position={[0.3, 1.23, -0.02]}
        radius={0.06}
        smoothness={4}
      >
        <meshStandardMaterial
          color={colors.nacelle}
          metalness={0.08}
          roughness={0.38}
        />
      </RoundedBox>
      <mesh
        castShadow
        position={[-0.03, 1.23, 0.16]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.06, 0.075, 0.22, 32]} />
        <meshStandardMaterial
          color={colors.hub}
          metalness={0.16}
          roughness={0.34}
        />
      </mesh>
      <group position={[-0.08, 1.23, 0.26]} ref={rotorRef}>
        {[0, 1, 2].map((bladeIndex) => (
          <WindBlade
            color={colors.blade}
            key={bladeIndex}
            rotation={(bladeIndex * Math.PI * 2) / 3}
          />
        ))}
        <mesh castShadow>
          <sphereGeometry args={[0.13, 32, 20]} />
          <meshStandardMaterial
            color={colors.hub}
            metalness={0.18}
            roughness={0.34}
          />
        </mesh>
      </group>
    </group>
  );
}

function WindBlade({ color, rotation }: { color: string; rotation: number }) {
  return (
    <group rotation={[0, 0, rotation]}>
      <mesh castShadow position={[0, 0.52, 0]} scale={[0.54, 1, 0.16]}>
        <cylinderGeometry args={[0.025, 0.08, 0.95, 18]} />
        <meshStandardMaterial color={color} metalness={0.04} roughness={0.24} />
      </mesh>
      <mesh castShadow position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.045, 0.058, 0.18, 18]} />
        <meshStandardMaterial color={color} metalness={0.05} roughness={0.26} />
      </mesh>
    </group>
  );
}

function WindFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}

function getWindSceneColors(theme: string | undefined) {
  const dark = theme === "dark";

  return {
    blade: dark ? "#e5e7eb" : "#f8fafc",
    foundation: dark ? "#475569" : "#cbd5e1",
    groundLight: dark ? "#1f2937" : "#d7e8df",
    hub: dark ? "#cbd5e1" : "#64748b",
    nacelle: dark ? "#cbd5e1" : "#e2e8f0",
    skyLight: dark ? "#93c5fd" : "#dbeafe",
    tower: dark ? "#cbd5e1" : "#d1d5db",
    wind: dark ? "#38bdf8" : "#0284c7",
  };
}
