"use client";

import { useFrame } from "@react-three/fiber";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { getColor } from "@repo/design-system/lib/color";
import { useRef } from "react";
import type { Mesh, PointLight } from "three";

export interface RocketExhaust {
  anchor: [number, number, number];
  radius: number;
}
const SPACE_COLORS = {
  flameCore: getColor("YELLOW"),
  flameOuter: getColor("ORANGE", 500),
  smoke: getColor("SLATE", 200),
};
const SMOKE_PARTICLE_COUNT = 18;
const SMOKE_PARTICLES = Array.from(
  { length: SMOKE_PARTICLE_COUNT },
  (_, index) => ({ id: `smoke-${index}`, index })
);

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
  const flameRadius = exhaust.radius * 1.75;
  const flameLength = exhaust.radius * 7.4;
  const coreRadius = exhaust.radius * 0.72;
  const coreLength = exhaust.radius * 4.2;
  const flameOffset = flameLength / 2 + exhaust.radius * 0.45;
  const coreOffset = coreLength / 2 + exhaust.radius * 0.32;

  useFrame(({ clock }) => {
    const pulse = 0.86 + Math.sin(clock.elapsedTime * 18) * 0.14;
    flameRef.current?.scale.set(1, pulse, 1);
    coreRef.current?.scale.set(1, 0.86 + pulse * 0.14, 1);

    if (lightRef.current) {
      lightRef.current.intensity = 0.78 + pulse * 0.48;
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
            min: Math.min(
              flameOffset - flameLength / 2,
              coreOffset - coreLength / 2
            ),
            max: Math.max(
              flameOffset + flameLength / 2,
              coreOffset + coreLength / 2
            ),
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
        <mesh position={[0, flameOffset, 0]} ref={flameRef}>
          <coneGeometry args={[flameRadius, flameLength, 32]} />
          <meshBasicMaterial
            color={SPACE_COLORS.flameOuter}
            depthWrite={false}
            opacity={0.68}
            transparent
          />
        </mesh>
        <mesh position={[0, coreOffset, 0]} ref={coreRef}>
          <coneGeometry args={[coreRadius, coreLength, 28]} />
          <meshBasicMaterial
            color={SPACE_COLORS.flameCore}
            depthWrite={false}
            opacity={0.88}
            transparent
          />
        </mesh>
      </CameraBounds>
      <CameraBounds exclude>
        <SmokeTrail exhaustRadius={exhaust.radius} />
      </CameraBounds>
    </group>
  );
}

function SmokeTrail({ exhaustRadius }: { exhaustRadius: number }) {
  return (
    <group>
      {SMOKE_PARTICLES.map((particle) => (
        <SmokePuff
          exhaustRadius={exhaustRadius}
          index={particle.index}
          key={particle.id}
        />
      ))}
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

  useFrame(({ clock }) => {
    if (!puffRef.current) {
      return;
    }

    const phase = (clock.elapsedTime * 0.74 + index / SMOKE_PARTICLE_COUNT) % 1;
    const drift = exhaustRadius * (2.4 + phase * 11 + index * 0.28);
    const wave =
      Math.sin(index * 1.7 + clock.elapsedTime * 2.1) * exhaustRadius * 0.92;
    puffRef.current.position.set(0, drift, wave);
    puffRef.current.scale.setScalar(exhaustRadius * (0.64 + phase * 2.25));
  });

  return (
    <mesh ref={puffRef}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial
        color={SPACE_COLORS.smoke}
        depthWrite={false}
        opacity={0.18}
        transparent
      />
    </mesh>
  );
}
