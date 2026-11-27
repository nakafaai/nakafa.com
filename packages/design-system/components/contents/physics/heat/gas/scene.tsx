import { useFrame } from "@react-three/fiber";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { Gauge } from "@repo/design-system/components/contents/physics/bench/gauge";
import { nichromeColor } from "@repo/design-system/components/contents/physics/bench/resistor";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { Tube } from "@repo/design-system/components/contents/physics/bench/vessel";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { Color } from "three";

/** The cylinder: its bore, where its floor lies, and how tall the gas stands at its starting volume. */
const BORE = 0.5;
const FLOOR = 0.2;
const CHAMBER = 1.3;
/** The molecules: how many, how big, and how fast one moves at 300 K, in scene units a second. */
const MOLECULES = 44;
const SIZE = 0.038;
const PACE = 1.1;
/** How quickly the piston follows a new volume while the card plays, as a share of the gap closed each second. */
const FOLLOW = 3.2;

/**
 * A fixed mass of gas in a glass cylinder on a hot plate, shut in by a
 * piston whose rod carries a handle, with a pressure gauge teed off the
 * base. The gas stands `volume` of its starting height. While the card
 * plays its molecules fly in straight lines and bounce off the walls, the
 * floor and the piston, faster the hotter the gas is, and the hot plate
 * glows once the gas is being `heated`.
 */
export function GasPistonScene({
  full,
  heated,
  kelvin,
  pressure,
  volume,
}: {
  readonly full: number;
  readonly heated: boolean;
  readonly kelvin: number;
  readonly pressure: number;
  readonly volume: number;
}) {
  const quantity = useQuantity();
  const playing = useVisualScene((card) => card.playing, false);
  const piston = useRef<Group>(null);
  const swarm = useRef<Group>(null);
  const shown = useRef(volume);
  const molecules = useMemo(
    () =>
      Arr.makeBy(MOLECULES, (index) => {
        const angle = hashUnit(index, 11) * Math.PI * 2;
        const reach = Math.sqrt(hashUnit(index, 12)) * (BORE - SIZE);
        const turn = hashUnit(index, 13) * Math.PI * 2;
        const tilt = Math.acos(hashUnit(index, 14) * 2 - 1);
        return {
          key: index,
          // Where the molecule is: across the bore in scene units, and up the chamber as a share of its height.
          place: [
            Math.cos(angle) * reach,
            0.06 + hashUnit(index, 15) * 0.88,
            Math.sin(angle) * reach,
          ],
          // Which way it flies, as a unit vector, and how its own speed compares with the average.
          way: [
            Math.sin(tilt) * Math.cos(turn),
            Math.cos(tilt),
            Math.sin(tilt) * Math.sin(turn),
          ],
          zeal: 0.6 + hashUnit(index, 16) * 0.8,
        };
      }),
    []
  );
  const tint = useMemo(() => {
    const warmth = Math.min(1, Math.max(0, (kelvin - 280) / 320));
    return `#${new Color(APPARATUS_COLORS.gasCool)
      .lerp(new Color(APPARATUS_COLORS.gasHot), warmth)
      .getHexString()}`;
  }, [kelvin]);

  useFrame((_, delta) => {
    const step = playing ? simulationStep(delta) : 0;
    shown.current = playing
      ? shown.current + (volume - shown.current) * Math.min(1, step * FOLLOW)
      : volume;
    const tall = CHAMBER * shown.current;
    piston.current?.position.setY(FLOOR + tall);
    const speed = PACE * Math.sqrt(kelvin / 300) * step;
    Arr.forEach(swarm.current?.children ?? [], (mesh, index) => {
      const molecule = molecules[index];
      if (molecule === undefined) {
        return;
      }
      const { place, way } = molecule;
      const [x = 0, y = 0, z = 0] = place;
      const [wx = 0, wy = 0, wz = 0] = way;
      let nextX = x + wx * speed * molecule.zeal;
      let nextY = y + (wy * speed * molecule.zeal) / tall;
      let nextZ = z + wz * speed * molecule.zeal;
      const out = Math.hypot(nextX, nextZ);
      const edge = BORE - SIZE;
      if (out > edge) {
        // Bounce off the glass: turn the outward part of the flight back inward.
        const nx = nextX / out;
        const nz = nextZ / out;
        const along = wx * nx + wz * nz;
        way[0] = wx - 2 * along * nx;
        way[2] = wz - 2 * along * nz;
        nextX = nx * edge;
        nextZ = nz * edge;
      }
      const margin = SIZE / tall;
      if (nextY < margin || nextY > 1 - margin) {
        way[1] = nextY < margin ? Math.abs(wy) : -Math.abs(wy);
        nextY = Math.min(1 - margin, Math.max(margin, nextY));
      }
      place[0] = nextX;
      place[1] = nextY;
      place[2] = nextZ;
      mesh.position.set(nextX, FLOOR + nextY * tall, nextZ);
    });
  });

  return (
    <group>
      <BenchCamera
        narrow={[0.9, 2.2, 7]}
        target={[0.3, 1.15, 0]}
        wide={[0.9, 1.7, 5.5]}
      />
      <mesh castShadow position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.1, 1.3]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={APPARATUS_COLORS.caseSteel}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0, 0.115, 0]} receiveShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.03, 48]} />
        <meshStandardMaterial
          color={heated ? nichromeColor(0.55) : APPARATUS_COLORS.bakelite}
          emissive={
            heated ? APPARATUS_COLORS.nichromeWarm : APPARATUS_COLORS.bakelite
          }
          emissiveIntensity={heated ? 1.1 : 0}
          roughness={0.7}
        />
      </mesh>
      <mesh castShadow position={[0, 0.165, 0]}>
        <cylinderGeometry args={[BORE + 0.05, BORE + 0.05, 0.07, 48]} />
        <MetalMaterial color={APPARATUS_COLORS.caseSteel} roughness={0.36} />
      </mesh>
      <group ref={swarm}>
        {Arr.map(molecules, (molecule) => (
          <mesh key={molecule.key}>
            <sphereGeometry args={[SIZE, 14, 10]} />
            <meshStandardMaterial
              color={tint}
              emissive={tint}
              emissiveIntensity={0.35}
              roughness={0.35}
            />
          </mesh>
        ))}
      </group>
      <group position={[0, FLOOR + CHAMBER * volume, 0]} ref={piston}>
        <mesh castShadow position={[0, 0.05, 0]}>
          <cylinderGeometry args={[BORE - 0.006, BORE - 0.006, 0.1, 48]} />
          <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[BORE - 0.012, 0.016, 10, 48]} />
          <meshStandardMaterial
            color={APPARATUS_COLORS.rubberFoot}
            roughness={0.85}
          />
        </mesh>
        <mesh castShadow position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 1, 16]} />
          <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.22} />
        </mesh>
        <mesh castShadow position={[0, 1.13, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 32]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={APPARATUS_COLORS.bakelite}
            roughness={0.4}
          />
        </mesh>
      </group>
      <Tube bottom={FLOOR} height={CHAMBER + 0.5} radius={BORE} />
      <mesh
        castShadow
        position={[0.78, 0.165, 0.2]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.03, 0.03, 0.56, 14]} />
        <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.3} />
      </mesh>
      <group position={[1.06, 0.14, 0.2]}>
        <Gauge share={pressure / full}>
          <InlineMath math={`p=${quantity(pressure, "\\text{ kPa}", 0)}`} />
        </Gauge>
      </group>
      <Tag
        anchorX="right"
        position={[-BORE - 0.12, FLOOR + CHAMBER * volume * 0.5, 0]}
      >
        <InlineMath math={`T=${quantity(kelvin, "\\text{ K}", 0)}`} />
      </Tag>
    </group>
  );
}
