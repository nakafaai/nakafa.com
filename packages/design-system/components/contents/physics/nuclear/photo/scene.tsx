import { useFrame } from "@react-three/fiber";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { Lead } from "@repo/design-system/components/contents/physics/bench/lead";
import {
  METER_POSTS,
  Meter,
} from "@repo/design-system/components/contents/physics/bench/meter";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Turn } from "@repo/design-system/components/three/form/part";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { Array as Arr, Option } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Quaternion,
  Vector3,
} from "three";

/** The photocell: the height of its axis, half its length, and its radius. */
const AXIS = 0.95;
const HALF = 0.95;
const RADIUS = 0.42;
/** Where the emitting plate and the collecting ring stand along the tube. */
const PLATE = -0.5;
const RING = 0.58;
/** The lamp: where its lens is, and where on the plate its beam lands. */
const LENS = new Vector3(0.75, 2.25, 1.15);
const SPOT = new Vector3(PLATE + 0.04, AXIS, 0);
const PHOTONS = 12;
const ELECTRONS = 14;

/** The colours light passes through from the ultraviolet to the red, each with the wavelength it stands at, in nanometres. */
const SPECTRUM = [
  [300, APPARATUS_COLORS.photonUltra],
  [400, APPARATUS_COLORS.photonViolet],
  [460, APPARATUS_COLORS.photonBlue],
  [530, APPARATUS_COLORS.photonGreen],
  [580, APPARATUS_COLORS.photonYellow],
  [610, APPARATUS_COLORS.photonOrange],
  [700, APPARATUS_COLORS.photonRed],
] as const;

const BULB = [
  [0.001, -HALF - 0.16],
  [RADIUS * 0.5, -HALF - 0.11],
  [RADIUS * 0.86, -HALF],
  [RADIUS, -HALF + 0.18],
  [RADIUS, HALF - 0.18],
  [RADIUS * 0.86, HALF],
  [RADIUS * 0.5, HALF + 0.11],
  [0.001, HALF + 0.16],
] as const;
const METER_AT = [1.7, 0, 0.7] as const;

/** The colour of light of `wavelength` nanometres, blended between its neighbours in the spectrum. */
function lightColor(wavelength: number) {
  const upper = Math.max(
    1,
    Option.getOrElse(
      Arr.findFirstIndex(SPECTRUM, ([edge]) => edge >= wavelength),
      () => SPECTRUM.length - 1
    )
  );
  const [low, cool] = SPECTRUM[upper - 1] ?? SPECTRUM[0];
  const [high, warm] = SPECTRUM[upper] ?? SPECTRUM[0];
  const share = Math.min(1, Math.max(0, (wavelength - low) / (high - low)));
  return `#${new Color(cool).lerp(new Color(warm), share).getHexString()}`;
}

/**
 * The photoelectric effect on the bench: an evacuated glass photocell on
 * its cradle with a curved metal plate and a collecting ring, a lamp that
 * throws a beam of the chosen colour onto the plate, and a meter in the
 * circuit between plate and ring. While the card plays, photons run down
 * the beam, more of them the brighter the light; if one photon carries more
 * than the work function, electrons leave the plate for the ring, faster
 * the more energy is to spare, and the meter reads a current.
 */
export function PhotoelectricScene({
  emits,
  energy,
  intensity,
  kinetic,
  wavelength,
  work,
}: {
  readonly emits: boolean;
  readonly energy: number;
  readonly intensity: number;
  readonly kinetic: number;
  readonly wavelength: number;
  readonly work: number;
}) {
  const quantity = useQuantity();
  const playing = useVisualScene((card) => card.playing, false);
  const color = useMemo(() => lightColor(wavelength), [wavelength]);
  const elapsed = useRef(0);
  const photons = useRef<Group>(null);
  const electrons = useRef<Group>(null);
  const beam = useMemo(() => {
    const span = SPOT.clone().sub(LENS);
    return {
      length: span.length(),
      middle: LENS.clone().add(SPOT).multiplyScalar(0.5),
      turn: new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        span.clone().normalize()
      ),
      way: span.clone().normalize(),
    };
  }, []);
  const seeds = useMemo(
    () =>
      Arr.makeBy(ELECTRONS, (index) => ({
        key: index,
        phase: hashUnit(index, 71),
        y: (hashUnit(index, 72) - 0.5) * 0.36,
        z: (hashUnit(index, 73) - 0.5) * 0.3,
      })),
    []
  );

  useFrame((_, delta) => {
    if (playing) {
      elapsed.current += simulationStep(delta);
    }
    Arr.forEach(photons.current?.children ?? [], (mesh, index) => {
      const along = (elapsed.current * 0.9 + index / PHOTONS) % 1;
      mesh.position.copy(LENS).addScaledVector(beam.way, along * beam.length);
      mesh.visible = playing && (index + 0.5) / PHOTONS < intensity + 0.05;
    });
    const pace = 0.35 + Math.sqrt(kinetic) * 0.75;
    Arr.forEach(electrons.current?.children ?? [], (mesh, index) => {
      const seed = seeds[index];
      if (seed === undefined) {
        return;
      }
      const along = (elapsed.current * pace + seed.phase) % 1;
      mesh.position.set(
        PLATE + 0.06 + along * (RING - PLATE - 0.1),
        AXIS + seed.y * (1 - along * 0.6),
        seed.z * (1 - along * 0.6)
      );
      mesh.visible =
        emits && playing && (index + 0.5) / ELECTRONS < intensity + 0.05;
    });
  });

  return (
    <group>
      <BenchCamera
        narrow={[0.9, 2.9, 9.2]}
        target={[0.5, 1.05, 0.2]}
        wide={[0.7, 2, 5.6]}
      />
      <mesh castShadow position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[2.5, 0.08, 1]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={APPARATUS_COLORS.bakelite}
          roughness={0.42}
        />
      </mesh>
      {Arr.map([-HALF + 0.12, HALF - 0.12] as const, (x) => (
        <mesh castShadow key={x} position={[x, (AXIS - RADIUS) / 2 + 0.06, 0]}>
          <boxGeometry args={[0.1, AXIS - RADIUS - 0.04, 0.5]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={APPARATUS_COLORS.bakelite}
            roughness={0.42}
          />
        </mesh>
      ))}
      <group position={[0, AXIS, 0]}>
        <mesh
          castShadow
          position={[PLATE - 0.3, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry
            args={[
              0.34,
              0.34,
              0.62,
              40,
              1,
              true,
              Math.PI * 0.18,
              Math.PI * 0.64,
            ]}
          />
          <meshPhysicalMaterial
            color={APPARATUS_COLORS.cathodeMetal}
            metalness={1}
            roughness={0.3}
            side={DoubleSide}
          />
        </mesh>
        <mesh position={[PLATE - 0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, HALF + PLATE + 0.3, 10]} />
          <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.3} />
        </mesh>
        <mesh castShadow position={[RING, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.16, 0.014, 12, 40]} />
          <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.26} />
        </mesh>
        <mesh
          position={[(RING + HALF + 0.1) / 2, -0.16, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.014, 0.014, HALF + 0.1 - RING, 10]} />
          <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.3} />
        </mesh>
        <mesh castShadow renderOrder={3} rotation={[0, 0, Math.PI / 2]}>
          <Turn profile={BULB} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.16} />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={side}
            position={[side * (HALF + 0.18), 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.1, 0.1, 0.12, 24]} />
            <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <group position={LENS}>
        <mesh
          castShadow
          position={beam.way.clone().multiplyScalar(-0.3)}
          quaternion={beam.turn}
        >
          <cylinderGeometry args={[0.2, 0.16, 0.6, 32]} />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={APPARATUS_COLORS.caseDark}
            roughness={0.4}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.12, 20, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6 + intensity * 2.4}
          />
        </mesh>
      </group>
      <mesh
        castShadow
        position={[LENS.x + 0.5, LENS.y / 2 + 0.1, LENS.z + 0.25]}
      >
        <cylinderGeometry args={[0.03, 0.03, LENS.y + 0.2, 16]} />
        <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.26} />
      </mesh>
      <mesh
        castShadow
        position={[LENS.x + 0.5, 0.03, LENS.z + 0.25]}
        receiveShadow
      >
        <cylinderGeometry args={[0.3, 0.32, 0.06, 40]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={APPARATUS_COLORS.caseDark}
          roughness={0.45}
        />
      </mesh>
      <mesh
        position={[LENS.x + 0.28, LENS.y + 0.14, LENS.z + 0.14]}
        rotation={[Math.PI / 2, 0, -Math.PI / 3]}
      >
        <cylinderGeometry args={[0.022, 0.022, 0.6, 12]} />
        <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.3} />
      </mesh>
      <mesh position={beam.middle} quaternion={beam.turn} renderOrder={5}>
        <cylinderGeometry args={[0.2, 0.1, beam.length, 32, 1, true]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color={color}
          depthWrite={false}
          opacity={0.1 + intensity * 0.3}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <group ref={photons}>
        {Arr.makeBy(PHOTONS, (index) => (
          <mesh key={index} visible={false}>
            <sphereGeometry args={[0.03, 12, 10]} />
            <meshBasicMaterial color={color} />
          </mesh>
        ))}
      </group>
      <group ref={electrons}>
        {Arr.map(seeds, (seed) => (
          <mesh key={seed.key} visible={false}>
            <sphereGeometry args={[0.024, 12, 10]} />
            <meshStandardMaterial
              color={APPARATUS_COLORS.electron}
              emissive={APPARATUS_COLORS.electron}
              emissiveIntensity={1.8}
            />
          </mesh>
        ))}
      </group>
      <Lead
        color={APPARATUS_COLORS.leadRed}
        points={[
          [HALF + 0.24, AXIS, 0],
          [HALF + 0.55, AXIS - 0.35, -0.1],
          [METER_AT[0] + 0.5, 0.06, 0.1],
          [METER_AT[0] + 0.52, 0.06, METER_AT[2] + 0.7],
          [
            METER_AT[0] + METER_POSTS[0][0] * 1.5,
            0.16,
            METER_AT[2] + METER_POSTS[0][2] * 1.5,
          ],
        ]}
      />
      <Lead
        color={APPARATUS_COLORS.leadBlack}
        points={[
          [-HALF - 0.24, AXIS, 0],
          [-HALF - 0.4, 0.3, 0.5],
          [0, 0.05, 1],
          [METER_AT[0] - 0.3, 0.06, METER_AT[2] + 0.62],
          [
            METER_AT[0] + METER_POSTS[1][0] * 1.5,
            0.16,
            METER_AT[2] + METER_POSTS[1][2] * 1.5,
          ],
        ]}
      />
      <group position={METER_AT} scale={1.5}>
        <Meter share={emits ? 0.15 + intensity * 0.7 : 0}>
          <InlineMath math={emits ? "I>0" : "I=0"} />
        </Meter>
      </group>
      <Tag
        anchorX="left"
        position={[beam.middle.x + 0.3, beam.middle.y + 0.1, beam.middle.z]}
      >
        <InlineMath math={`hf=${quantity(energy, "\\text{ eV}", 2)}`} />
      </Tag>
      <Tag position={[PLATE - 0.35, AXIS + RADIUS + 0.2, 0]}>
        <InlineMath math={`\\phi=${quantity(work, "\\text{ eV}", 2)}`} />
      </Tag>
      {emits ? (
        <Tag position={[0.1, AXIS - RADIUS - 0.16, 0.4]}>
          <InlineMath math={`E_k=${quantity(kinetic, "\\text{ eV}", 2)}`} />
        </Tag>
      ) : null}
    </group>
  );
}
