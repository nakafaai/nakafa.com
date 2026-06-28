"use client";

import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { BLUE_MARBLE_EARTH_TEXTURE_ASSET } from "@repo/design-system/components/contents/biology/assets";
import {
  type BiologySceneColors,
  getBiologySceneColors,
} from "@repo/design-system/components/contents/biology/data";
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
import { type Group, SRGBColorSpace } from "three";

const DEFAULT_GAS_LEVEL = 3;
const HEAT_PARTICLE_IDS = Array.from(
  { length: 14 },
  (_, index) => `heat-${index}`
);

interface GreenhouseLabels {
  gasControl: string;
  heatFlow: ReactNode;
  heatFlowLabel: string;
  meaning: ReactNode;
  meaningLabel: string;
  viewLabel: string;
}

interface GreenhouseEffectLabProps {
  description: ReactNode;
  labels: GreenhouseLabels;
  title: ReactNode;
}

export function GreenhouseEffectLab(props: GreenhouseEffectLabProps) {
  const { description, labels, title } = props;
  const [gasLevel, setGasLevel] = useState(DEFAULT_GAS_LEVEL);
  const { resolvedTheme } = useTheme();
  const colors = getBiologySceneColors(resolvedTheme);

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
            camera={{ fov: 42, position: [3, 1.7, 4.05] }}
            frameloop="always"
          >
            <Suspense>
              <CameraControls
                autoRotate={false}
                cameraPosition={[3, 1.7, 4.05]}
                cameraTarget={[0.1, 0.08, 0]}
                maxDistance={7}
                minDistance={2.15}
              />
              <ambientLight intensity={0.58} />
              <hemisphereLight
                color={colors.skyLight}
                groundColor={colors.soil}
                intensity={0.72}
              />
              <directionalLight intensity={1.5} position={[-4, 3, 3]} />
              <GreenhouseScene colors={colors} gasLevel={gasLevel} />
            </Suspense>
          </ThreeCanvas>
        </section>

        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.gasControl}</span>
            <span className="shrink-0 tabular-nums">{gasLevel}/5</span>
          </div>
          <Slider
            aria-label={labels.gasControl}
            max={5}
            min={1}
            onValueChange={setGasLevel}
            step={1}
            value={gasLevel}
          />
        </div>
      </CardContent>
      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <GreenhouseFact
            label={labels.heatFlowLabel}
            value={labels.heatFlow}
          />
          <GreenhouseFact label={labels.meaningLabel} value={labels.meaning} />
        </dl>
      </CardFooter>
    </Card>
  );
}

function GreenhouseScene({
  colors,
  gasLevel,
}: {
  colors: BiologySceneColors;
  gasLevel: number;
}) {
  const earthRef = useRef<Group>(null);
  const heatRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.12;
    }

    if (heatRef.current) {
      heatRef.current.rotation.y -= delta * 0.18;
    }
  });

  return (
    <group position={[0, 0.02, 0]}>
      <SunLight color={colors.grain} />
      <group ref={earthRef}>
        <EarthModel colors={colors} gasLevel={gasLevel} />
      </group>
      <HeatParticles
        color={colors.heat}
        gasLevel={gasLevel}
        refObject={heatRef}
      />
    </group>
  );
}

function EarthModel({
  colors,
  gasLevel,
}: {
  colors: BiologySceneColors;
  gasLevel: number;
}) {
  const texture = useTexture(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);
  texture.colorSpace = SRGBColorSpace;
  const particles = useMemo(() => createGasParticles(gasLevel), [gasLevel]);

  return (
    <group>
      <mesh rotation={[0.1, -1.28, 0]}>
        <sphereGeometry args={[0.94, 96, 48]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.1, 96, 48]} />
        <meshStandardMaterial
          color={colors.ice}
          opacity={0.17 + gasLevel * 0.035}
          transparent
        />
      </mesh>
      {particles.map((particle) => (
        <mesh key={particle.id} position={particle.position}>
          <sphereGeometry args={[0.035, 18, 12]} />
          <meshStandardMaterial
            color={colors.carbon}
            emissive={colors.carbon}
            emissiveIntensity={0.08}
          />
        </mesh>
      ))}
    </group>
  );
}

function SunLight({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[-2.55, 1.3, 0]}>
        <sphereGeometry args={[0.18, 32, 20]} />
        <meshStandardMaterial color={color} emissive={color} />
      </mesh>
      {[-0.22, 0, 0.22].map((offset) => (
        <mesh
          key={offset}
          position={[-1.55, 0.94 + offset, 0.12]}
          rotation={[0, 0, Math.PI / 2.9]}
        >
          <cylinderGeometry args={[0.012, 0.012, 1.08, 18]} />
          <meshStandardMaterial color={color} opacity={0.2} transparent />
        </mesh>
      ))}
    </group>
  );
}

function HeatParticles({
  color,
  gasLevel,
  refObject,
}: {
  color: string;
  gasLevel: number;
  refObject: RefObject<Group | null>;
}) {
  const particleCount = 4 + gasLevel * 2;

  return (
    <group ref={refObject}>
      {HEAT_PARTICLE_IDS.slice(0, particleCount).map((id, index) => (
        <mesh key={id} position={getHeatParticlePosition(index, particleCount)}>
          <sphereGeometry args={[0.026, 18, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.38}
            opacity={0.42}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function getHeatParticlePosition(index: number, total: number) {
  const angle = (index / total) * Math.PI * 1.35 - Math.PI * 0.18;
  const radius = 1.02 + (index % 3) * 0.06;

  return [
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * 0.9,
    0.56 + (index % 2) * 0.08,
  ] as const;
}

function GreenhouseFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}

function createGasParticles(level: number) {
  return Array.from({ length: 8 + level * 4 }, (_, index) => {
    const y = 1 - (index / Math.max(1, 7 + level * 4)) * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const radius = 1.16;

    return {
      id: `gas-${index}`,
      position: [
        Math.cos(angle) * ringRadius * radius,
        y * radius,
        Math.sin(angle) * ringRadius * radius,
      ] as const,
    };
  });
}

useTexture.preload(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);
