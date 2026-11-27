import { useFrame } from "@react-three/fiber";
import { useGlow } from "@repo/design-system/components/three/atom/light";
import type { Orbit } from "@repo/design-system/components/three/atom/shell";
import {
  electronsInto,
  electronsOf,
  fadesOf,
  TRAIL,
} from "@repo/design-system/components/three/atom/shell";
import { facetsOf } from "@repo/design-system/components/three/molecule/ball";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { PARTICLE_COLORS } from "@repo/design-system/lib/material/particle";
import { Array as Arr, Option } from "effect";
import type { RefObject } from "react";
import { createContext, use, useLayoutEffect, useMemo, useRef } from "react";
import type { BufferAttribute, Points } from "three";
import { AdditiveBlending, Color } from "three";

/** The radius of an orbit's bright line and of the soft light around it, as shares of the innermost orbit's radius. */
const LINE = 0.008;
const HALO = 0.035;

/** How large an electron's glow is drawn, as a share of the innermost orbit's radius. */
const SPARK = 1.25;

/** How much wider than the outermost orbit the faint haze of the atom's electron cloud is drawn. */
const HAZE = 3.4;

/** How far past the bloom threshold an electron and a valence path shine. */
const SHINE = 3.2;

/** The model's time in seconds, which its electrons read each frame; zero outside a model. */
const Clock = createContext<RefObject<number>>({ current: 0 });

/**
 * The shells of a Bohr model as light: each orbit a thin luminous path in
 * the plane y = 0 with a soft halo, and its electrons bright points that
 * leave a fading trail as they go round. The shell at index `valence`, and
 * the electrons on it, glow warm; the rest glow cool. `clock` holds the
 * model's time in seconds, which the caller advances, so the electrons
 * stand still while the lab is paused. All electrons and trails are one
 * draw call, and nothing is allocated while they move.
 */
export function BohrShells({
  clock,
  orbits,
  valence,
}: {
  readonly clock: RefObject<number>;
  readonly orbits: readonly Orbit[];
  readonly valence: number;
}) {
  const unit = Option.match(Arr.head(orbits), {
    onNone: () => 1,
    onSome: (first) => first.radius,
  });
  const glow = useGlow();
  const outer = Arr.reduce(orbits, unit, (far, orbit) =>
    Math.max(far, orbit.radius)
  );
  return (
    <group>
      <sprite scale={outer * HAZE}>
        <spriteMaterial
          blending={AdditiveBlending}
          color={PARTICLE_COLORS.shell}
          depthWrite={false}
          map={glow}
          opacity={0.16}
          toneMapped={false}
          transparent
        />
      </sprite>
      {Arr.map(orbits, (orbit, index) => (
        <Path
          key={orbit.radius}
          radius={orbit.radius}
          unit={unit}
          warm={index === valence}
        />
      ))}
      <Clock value={clock}>
        <Electrons
          key={Arr.join(
            Arr.map(orbits, (orbit) => String(orbit.electrons)),
            "-"
          )}
          orbits={orbits}
          unit={unit}
          valence={valence}
        />
      </Clock>
    </group>
  );
}

/** One orbit: a bright line and the soft light around it. */
function Path({
  radius,
  unit,
  warm,
}: {
  readonly radius: number;
  readonly unit: number;
  readonly warm: boolean;
}) {
  const { tier } = useStage();
  const sides = facetsOf(tier).sides * 5;
  const color = warm ? PARTICLE_COLORS.valenceShell : PARTICLE_COLORS.shell;
  const line = useMemo(
    () => new Color(color).multiplyScalar(warm ? SHINE : 1.4),
    [color, warm]
  );
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <torusGeometry
          args={[radius, unit * LINE * (warm ? 1.6 : 1), 8, sides]}
        />
        <meshBasicMaterial color={line} toneMapped={false} />
      </mesh>
      <mesh scale={[1, 1, 0.2]}>
        <torusGeometry args={[radius, unit * HALO, 8, sides]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color={color}
          depthWrite={false}
          opacity={warm ? 0.2 : 0.1}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}

/** Every electron and its trail as one cloud of glowing points. */
function Electrons({
  orbits,
  unit,
  valence,
}: {
  readonly orbits: readonly Orbit[];
  readonly unit: number;
  readonly valence: number;
}) {
  const glow = useGlow();
  const clock = use(Clock);
  const points = useRef<Points>(null);
  const place = useRef<BufferAttribute>(null);
  const { colors, places } = useMemo(() => {
    const fades = fadesOf(orbits);
    const tones = new Float32Array(fades.length * 3);
    const tone = new Color();
    let point = 0;
    Arr.forEach(orbits, (orbit, index) => {
      const base =
        index === valence ? PARTICLE_COLORS.valence : PARTICLE_COLORS.electron;
      for (let step = 0; step < orbit.electrons * TRAIL; step += 1) {
        tone.set(base).multiplyScalar(Number(fades[point]) * SHINE);
        tones[point * 3] = tone.r;
        tones[point * 3 + 1] = tone.g;
        tones[point * 3 + 2] = tone.b;
        point += 1;
      }
    });
    return {
      colors: tones,
      places: new Float32Array(electronsOf(orbits) * TRAIL * 3),
    };
  }, [orbits, valence]);

  useLayoutEffect(() => {
    electronsInto(places, orbits, clock.current);
    points.current?.geometry.computeBoundingSphere();
  }, [clock, orbits, places]);

  useFrame(() => {
    const attribute = place.current;
    if (attribute === null) {
      return;
    }
    electronsInto(places, orbits, clock.current);
    attribute.needsUpdate = true;
  });

  if (places.length === 0) {
    return null;
  }
  return (
    <points frustumCulled={false} ref={points}>
      <bufferGeometry>
        <bufferAttribute
          args={[places, 3]}
          attach="attributes-position"
          ref={place}
        />
        <bufferAttribute args={[colors, 3]} attach="attributes-color" />
      </bufferGeometry>
      <pointsMaterial
        alphaMap={glow}
        blending={AdditiveBlending}
        depthWrite={false}
        map={glow}
        size={unit * SPARK}
        toneMapped={false}
        transparent
        vertexColors
      />
    </points>
  );
}
