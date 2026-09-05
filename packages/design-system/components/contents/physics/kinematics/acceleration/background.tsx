"use client";

import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { getColor } from "@repo/design-system/lib/color";
import { useMemo } from "react";

const SPACE_COLORS = {
  atmosphere: getColor("SKY", 400),
  planet: getColor("TEAL", 700),
  rocketDark: getColor("SLATE", 600),
  space: getColor("ZINC", 950),
  star: getColor("WHITE"),
};
const SPACE_ROCK_COUNT = 18;
const SPEED_PARTICLE_COUNT = 56;
const STAR_COUNT = 90;

/** Scenic depth stays outside the finite lesson content used to fit the camera. */
export function SpaceBackground({ length }: { length: number }) {
  return (
    <>
      <color args={[SPACE_COLORS.space]} attach="background" />
      <CameraBounds exclude>
        <DistantPlanet />
        <StarField length={length} />
        <SpaceRocks length={length} />
        <SpeedParticles length={length} />
      </CameraBounds>
    </>
  );
}

function DistantPlanet() {
  return (
    <group position={[8.2, -3.1, -9.2]} rotation={[0.3, 0.2, -0.25]}>
      <mesh>
        <sphereGeometry args={[1.12, 32, 20]} />
        <meshStandardMaterial color={SPACE_COLORS.planet} roughness={0.72} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.55, 0.018, 8, 96]} />
        <meshBasicMaterial
          color={SPACE_COLORS.atmosphere}
          opacity={0.36}
          transparent
        />
      </mesh>
    </group>
  );
}

function StarField({ length }: { length: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, index) => {
        const progress = index / (STAR_COUNT - 1);
        const angle = index * 2.399_963_229_728_653;
        const radius = 3.2 + (index % 9) * 0.42;
        return {
          id: `star-${index}`,
          scale: 0.014 + (index % 5) * 0.006,
          x: -length / 2 - 3 + progress * (length + 6),
          y: Math.sin(angle) * radius,
          z: Math.cos(angle) * radius,
        };
      }),
    [length]
  );

  return (
    <group>
      {stars.map((star) => (
        <mesh key={star.id} position={[star.x, star.y, star.z]}>
          <sphereGeometry args={[star.scale, 8, 8]} />
          <meshBasicMaterial color={SPACE_COLORS.star} />
        </mesh>
      ))}
    </group>
  );
}

function SpaceRocks({ length }: { length: number }) {
  const rocks = useMemo(
    () =>
      Array.from({ length: SPACE_ROCK_COUNT }, (_, index) => {
        const progress = (index + 0.5) / SPACE_ROCK_COUNT;
        const angle = index * 1.847;
        const radius = 1.9 + (index % 6) * 0.34;

        return {
          id: `rock-${index}`,
          radius: 0.06 + (index % 4) * 0.025,
          rotation: [index * 0.31, index * 0.47, index * 0.19] as const,
          x: -length / 2 + progress * length,
          y: Math.sin(angle) * radius,
          z: Math.cos(angle) * radius,
        };
      }),
    [length]
  );

  return (
    <group>
      {rocks.map((rock) => (
        <mesh
          key={rock.id}
          position={[rock.x, rock.y, rock.z]}
          rotation={rock.rotation}
        >
          <icosahedronGeometry args={[rock.radius, 1]} />
          <meshStandardMaterial
            color={SPACE_COLORS.rocketDark}
            roughness={0.82}
          />
        </mesh>
      ))}
    </group>
  );
}

function SpeedParticles({ length }: { length: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: SPEED_PARTICLE_COUNT }, (_, index) => {
        const progress = index / (SPEED_PARTICLE_COUNT - 1);
        const angle = index * 1.231;
        const radius = 0.95 + (index % 5) * 0.32;
        return {
          id: `speed-particle-${index}`,
          opacity: 0.18 + (index % 4) * 0.06,
          size: 0.18 + (index % 3) * 0.08,
          x: -length / 2 + progress * length,
          y: Math.sin(angle) * radius,
          z: Math.cos(angle) * radius,
        };
      }),
    [length]
  );

  return (
    <group>
      {particles.map((particle) => (
        <mesh key={particle.id} position={[particle.x, particle.y, particle.z]}>
          <boxGeometry args={[particle.size, 0.01, 0.01]} />
          <meshBasicMaterial
            color={SPACE_COLORS.atmosphere}
            opacity={particle.opacity}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}
