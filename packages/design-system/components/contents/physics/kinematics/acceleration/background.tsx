import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { getColor } from "@repo/design-system/lib/color";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BackSide,
  Color,
  DataTexture,
  DoubleSide,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

/** The radius of the distant planet, in scene units. */
const PLANET = 1.12;

const SPACE_COLORS = {
  atmosphere: PLOT_COLORS.violet,
  rocketDark: getColor("SLATE", 600),
  star: getColor("WHITE"),
};
const SPACE_ROCK_COUNT = 18;
const SPEED_PARTICLE_COUNT = 56;
const STAR_COUNT = 90;

/**
 * Scenic depth stays outside the finite lesson content used to fit the camera. The scene
 * passes its layers, which draw over the same length, as its children.
 */
export function SpaceBackground({ children }: { children: ReactNode }) {
  return (
    <CameraBounds exclude>
      <DistantPlanet />
      {children}
    </CameraBounds>
  );
}

/** Texels around and down the giant's cloud map. */
const CLOUD = { height: 128, width: 256 } as const;

/** The giant's rings from its inner edge outward: [inner, outer, opacity], in planet radii. */
const RINGS = [
  [1.32, 1.5, 0.14],
  [1.52, 1.84, 0.34],
  [1.87, 1.93, 0.1],
  [1.97, 2.22, 0.26],
  [2.26, 2.33, 0.08],
] as const;

/**
 * Paints the cloud tops of an ice giant: broad pale and deep belts whose
 * edges the winds have bent into waves, so the disc is banded rather than
 * one flat colour.
 */
function createCloudTexture() {
  const deep = new Color(QUANTUM_COLORS.iceGiantDeep);
  const pale = new Color(QUANTUM_COLORS.iceGiantPale);
  const cloud = new Color();
  const data = new Uint8Array(CLOUD.width * CLOUD.height * 4);
  for (let row = 0; row < CLOUD.height; row += 1) {
    const latitude = row / CLOUD.height;
    for (let column = 0; column < CLOUD.width; column += 1) {
      const longitude = (column / CLOUD.width) * Math.PI * 2;
      const belt = 0.5 + 0.5 * Math.sin(latitude * 9 + 1.3);
      const streak =
        0.5 +
        0.5 *
          Math.sin(
            latitude * 27 +
              0.5 * Math.sin(longitude * 3 + latitude * 9) +
              0.25 * Math.sin(longitude * 7 - latitude * 31)
          );
      cloud
        .copy(deep)
        .lerp(pale, belt * 0.6 + streak * 0.4)
        .convertLinearToSRGB();
      const texel = (row * CLOUD.width + column) * 4;
      data[texel] = Math.round(cloud.r * 255);
      data[texel + 1] = Math.round(cloud.g * 255);
      data[texel + 2] = Math.round(cloud.b * 255);
      data[texel + 3] = 255;
    }
  }
  const texture = new DataTexture(data, CLOUD.width, CLOUD.height);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A ringed ice giant far behind the flight: banded cloud tops lit by the
 * scene's sun, a thin haze at its limb, and dusty rings tilted to the view.
 */
function DistantPlanet() {
  const clouds = useMemo(createCloudTexture, []);
  useEffect(() => () => clouds.dispose(), [clouds]);

  return (
    <group position={[8.2, 3.1, -9.2]} rotation={[0.3, 0.2, -0.25]}>
      <mesh>
        <sphereGeometry args={[PLANET, 64, 40]} />
        <meshStandardMaterial map={clouds} roughness={0.9} />
      </mesh>
      <mesh>
        <sphereGeometry args={[PLANET * 1.03, 48, 32]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color={QUANTUM_COLORS.iceGiantHaze}
          depthWrite={false}
          opacity={0.12}
          side={BackSide}
          transparent
        />
      </mesh>
      {Arr.map(RINGS, ([inner, outer, opacity]) => (
        <mesh key={inner} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[PLANET * inner, PLANET * outer, 128]} />
          <meshBasicMaterial
            color={QUANTUM_COLORS.ringDust}
            depthWrite={false}
            opacity={opacity}
            side={DoubleSide}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

export function StarField({ length }: { length: number }) {
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
      {Arr.map(stars, (star) => (
        <mesh key={star.id} position={[star.x, star.y, star.z]}>
          <sphereGeometry args={[star.scale, 8, 8]} />
          <meshBasicMaterial color={SPACE_COLORS.star} />
        </mesh>
      ))}
    </group>
  );
}

export function SpaceRocks({ length }: { length: number }) {
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
      {Arr.map(rocks, (rock) => (
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

export function SpeedParticles({ length }: { length: number }) {
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
      {Arr.map(particles, (particle) => (
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
