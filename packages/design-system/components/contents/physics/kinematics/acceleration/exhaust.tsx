import { useFrame } from "@react-three/fiber";
import type { RocketExhaust } from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Mesh, PointLight } from "three";
import { Vector2 } from "three";

const SPACE_COLORS = {
  flameCore: PLOT_COLORS.amber,
  flameOuter: PLOT_COLORS.orange,
  smoke: getColor("SLATE", 200),
};
const SMOKE_PARTICLE_COUNT = 18;
const SMOKE_PARTICLES = Array.from(
  { length: SMOKE_PARTICLE_COUNT },
  (_, index) => ({ id: `smoke-${index}`, index })
);

function createPlumeProfile(radius: number, length: number) {
  return Arr.map(
    [
      [0.001, 0],
      [radius * 0.72, length * 0.05],
      [radius, length * 0.22],
      [radius * 0.88, length * 0.48],
      [radius * 0.56, length * 0.76],
      [radius * 0.22, length * 0.94],
      [0.001, length],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
}

export function AnimatedExhaust({
  direction,
  exhaust,
}: {
  direction: -1 | 1;
  exhaust: RocketExhaust;
}) {
  const flameRef = useRef<Mesh>(null);
  const coreRef = useRef<Mesh>(null);
  const lightRef = useRef<PointLight>(null);
  const { advance } = useSimulationClock(0);
  const flameRadius = exhaust.radius * 1.55;
  const flameLength = exhaust.radius * 7.2;
  const coreRadius = exhaust.radius * 0.76;
  const coreLength = exhaust.radius * 4.4;
  const flameStart = exhaust.radius * 0.25;

  const outerProfile = useMemo(
    () => createPlumeProfile(flameRadius, flameLength),
    [flameLength, flameRadius]
  );
  const coreProfile = useMemo(
    () => createPlumeProfile(coreRadius, coreLength),
    [coreLength, coreRadius]
  );

  useFrame((_, delta) => {
    const elapsed = advance(delta);
    const pulse = 0.88 + Math.sin(elapsed * 18) * 0.12;
    flameRef.current?.scale.set(1, pulse, 1);
    coreRef.current?.scale.set(1, 0.88 + pulse * 0.12, 1);

    if (lightRef.current) {
      lightRef.current.intensity = 0.85 + pulse * 0.55;
    }
  });

  return (
    <group
      position={exhaust.anchor}
      rotation={[0, 0, direction > 0 ? -Math.PI / 2 : Math.PI / 2]}
    >
      <CameraBounds
        bounds={{
          x: { min: -flameRadius, max: flameRadius },
          y: {
            min: flameStart,
            max: flameStart + flameLength,
          },
          z: { min: -flameRadius, max: flameRadius },
        }}
      >
        <pointLight
          color={SPACE_COLORS.flameOuter}
          distance={exhaust.radius * 22}
          intensity={1}
          ref={lightRef}
        />
        <mesh position={[0, flameStart, 0]} ref={flameRef}>
          <latheGeometry args={[outerProfile, 32]} />
          <meshStandardMaterial
            color={SPACE_COLORS.flameOuter}
            depthWrite={false}
            emissive={SPACE_COLORS.flameOuter}
            emissiveIntensity={1.8}
            opacity={0.62}
            roughness={0.2}
            transparent
          />
        </mesh>
        <mesh position={[0, flameStart, 0]} ref={coreRef}>
          <latheGeometry args={[coreProfile, 28]} />
          <meshStandardMaterial
            color={SPACE_COLORS.flameCore}
            depthWrite={false}
            emissive={SPACE_COLORS.flameCore}
            emissiveIntensity={3}
            opacity={0.92}
            roughness={0.12}
            transparent
          />
        </mesh>
      </CameraBounds>
      <CameraBounds exclude>
        <group>
          {Arr.map(SMOKE_PARTICLES, (particle) => (
            <SmokePuff
              exhaustRadius={exhaust.radius}
              index={particle.index}
              key={particle.id}
            />
          ))}
        </group>
      </CameraBounds>
    </group>
  );
}

function SmokePuff({
  exhaustRadius,
  index,
}: {
  exhaustRadius: number;
  index: number;
}) {
  const puffRef = useRef<Mesh>(null);
  const { advance } = useSimulationClock(0);

  useFrame((_, delta) => {
    if (!puffRef.current) {
      return;
    }

    const elapsed = advance(delta);
    const phase = (elapsed * 0.74 + index / SMOKE_PARTICLE_COUNT) % 1;
    const drift = exhaustRadius * (2.4 + phase * 11 + index * 0.28);
    const wave = Math.sin(index * 1.7 + elapsed * 2.1) * exhaustRadius * 0.92;
    puffRef.current.position.set(0, drift, wave);
    puffRef.current.scale.setScalar(exhaustRadius * (0.64 + phase * 2.25));
  });

  return (
    <mesh ref={puffRef}>
      <sphereGeometry args={[1, 14, 10]} />
      <meshBasicMaterial
        color={SPACE_COLORS.smoke}
        depthWrite={false}
        opacity={0.14}
        transparent
      />
    </mesh>
  );
}
