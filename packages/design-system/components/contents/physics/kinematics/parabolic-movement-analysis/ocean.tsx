import { useFrame } from "@react-three/fiber";
import {
  PROJECTILE_SCENE,
  type ProjectileMotionState,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { Sea } from "@repo/design-system/components/three/stage/sea";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Mesh } from "three";

/** The height of the sea the islands stand in. */
const SEA_LEVEL = -0.12;

const OCEAN_COLORS = {
  particle: getColor("WHITE"),
} as const;

const WIND_PARTICLE_COUNT = 36;
const OCEAN_SIDE_MARGIN = 120;
const WIND_PARTICLES = Array.from(
  { length: WIND_PARTICLE_COUNT },
  (_, index) => {
    const progress = index / (WIND_PARTICLE_COUNT - 1);

    return {
      id: `wind-${index}`,
      offset: (index * 0.137) % 1,
      radius: 0.012 + (index % 4) * 0.006,
      speed: 0.035 + (index % 6) * 0.009,
      y: 0.42 + Math.sin(index * 1.7) * 0.38,
      z: Math.sin(index * 1.19) * 6.8,
      progress,
    };
  }
);

export function Ocean({ motion }: { motion: ProjectileMotionState }) {
  const length = motion.rangeWorld + OCEAN_SIDE_MARGIN * 2;
  const centerX = PROJECTILE_SCENE.launchOffset[0] + motion.rangeWorld / 2;

  return (
    <group>
      <Sea level={SEA_LEVEL} />
      <group>
        {Arr.map(WIND_PARTICLES, (particle) => (
          <WindParticle
            centerX={centerX}
            key={particle.id}
            length={length}
            particle={particle}
          />
        ))}
      </group>
    </group>
  );
}

function WindParticle({
  centerX,
  length,
  particle,
}: {
  centerX: number;
  length: number;
  particle: (typeof WIND_PARTICLES)[number];
}) {
  const particleRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = particleRef.current;

    if (!mesh) {
      return;
    }

    const loop = (particle.offset + clock.elapsedTime * particle.speed) % 1;
    const x = centerX - length / 2 + loop * length;
    const y =
      particle.y + Math.sin(clock.elapsedTime * 1.1 + particle.progress) * 0.05;

    mesh.position.set(x, y, particle.z);
  });

  return (
    <mesh ref={particleRef}>
      <sphereGeometry args={[particle.radius, 10, 8]} />
      <meshBasicMaterial
        color={OCEAN_COLORS.particle}
        depthWrite={false}
        opacity={0.38}
        transparent
      />
    </mesh>
  );
}
