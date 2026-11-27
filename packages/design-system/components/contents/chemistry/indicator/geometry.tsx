import { Sweep, Turn } from "@repo/design-system/components/three/form/part";
import type { Path } from "@repo/design-system/components/three/form/path";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { DoubleSide, ExtrudeGeometry, Shape } from "three";

/** Creates a rounded rectangular glazed porcelain spotting tile geometry. */
function buildTileGeometry() {
  const halfW = 0.175;
  const halfD = 0.11;
  const corner = 0.012;
  const shape = new Shape();
  shape.moveTo(-halfW + corner, -halfD);
  shape.lineTo(halfW - corner, -halfD);
  shape.quadraticCurveTo(halfW, -halfD, halfW, -halfD + corner);
  shape.lineTo(halfW, halfD - corner);
  shape.quadraticCurveTo(halfW, halfD, halfW - corner, halfD);
  shape.lineTo(-halfW + corner, halfD);
  shape.quadraticCurveTo(-halfW, halfD, -halfW, halfD - corner);
  shape.lineTo(-halfW, -halfD + corner);
  shape.quadraticCurveTo(-halfW, -halfD, -halfW + corner, -halfD);
  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.002,
    bevelThickness: 0.002,
    depth: 0.008,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.002, 0);
  return geo;
}

/**
 * The outside of a 250 mL borosilicate beaker, from its base to its flared
 * lip. The base is dished a little, as blown glass is, so the beaker stands
 * on its rim and not flat on the tile.
 */
const BEAKER = [
  [0, 0.0005],
  [0.036, 0.0005],
  [0.042, 0],
  [0.0455, 0.004],
  [0.046, 0.01],
  [0.046, 0.112],
  [0.0485, 0.1165],
  [0.05, 0.118],
] as const;

/** The glass of a dropping pipette: up the outside of its nozzle and barrel, over its rim and back down its bore. */
const PIPETTE_GLASS = [
  [0.0012, 0],
  [0.0017, 0.012],
  [0.0028, 0.028],
  [0.0054, 0.044],
  [0.0055, 0.106],
  [0.0068, 0.11],
  [0.0052, 0.111],
  [0.0042, 0.105],
  [0.0042, 0.043],
  [0.0011, 0.002],
] as const;

/** The nitrile teat of the dropping pipette. */
const PIPETTE_BULB = [
  [0.0056, 0],
  [0.0074, 0.003],
  [0.0068, 0.01],
  [0.0115, 0.024],
  [0.0122, 0.036],
  [0.01, 0.046],
  [0.0055, 0.052],
  [0, 0.054],
] as const;

/** A falling drop of indicator: round below, drawn to a point above. */
const DROPLET = [
  [0, 0],
  [0.0024, 0.0009],
  [0.0036, 0.0028],
  [0.0033, 0.0052],
  [0.0018, 0.008],
  [0, 0.0108],
] as const;

/** The dry length of the test strip, leaning out over the beaker's rim. */
const DRY_STRIP: Path = [
  [0.027, 0.074, 0],
  [0.035, 0.098, 0],
  [0.045, 0.119, 0],
  [0.058, 0.132, 0],
  [0.071, 0.142, 0],
];

/** The wet length of the test strip, down in the solution. */
const WET_STRIP: Path = [
  [0.018, 0.032, 0],
  [0.021, 0.048, 0],
  [0.025, 0.064, 0],
  [0.028, 0.077, 0],
];

/** A paper strip's section: an eighth as thick as it is wide, its face toward the viewer. */
const PAPER = [0.12, [0, 0, 1]] as const;

/** Glazed white porcelain spotting tile sitting on the bench at y = 0. */
export function SpottingTile() {
  const geo = useMemo(buildTileGeometry, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const wells = Arr.makeBy(3, (index) => ({
    key: index,
    z: -0.05 + index * 0.05,
  }));

  return (
    <group>
      <mesh castShadow geometry={geo} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.78}
          clearcoatRoughness={0.16}
          color={BENCH_COLORS.ceramicTile}
          roughness={0.28}
        />
      </mesh>
      {Arr.map(wells, (well) => (
        <mesh
          key={well.key}
          position={[-0.135, 0.0124, well.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.007, 0.013, 24]} />
          <meshPhysicalMaterial
            clearcoat={0.9}
            color={BENCH_COLORS.dish}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Turned 250 mL borosilicate glass beaker with crisp volumetric graduation ticks. */
export function GraduatedBeaker() {
  const ticks = Arr.makeBy(7, (index) => ({
    key: index,
    major: index % 2 === 1,
    y: 0.022 + index * 0.0125,
  }));

  return (
    <group>
      <mesh castShadow>
        <Turn profile={BEAKER} wall={[0.0018, 0.003]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.04}
          color={BENCH_COLORS.glass}
          depthWrite={false}
          ior={1.473}
          metalness={0}
          opacity={0.26}
          roughness={0.05}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {Arr.map(ticks, (tick) => (
        <mesh key={tick.key} position={[0, tick.y, 0.0466]}>
          <boxGeometry args={[tick.major ? 0.016 : 0.009, 0.001, 0.0005]} />
          <meshBasicMaterial color={BENCH_COLORS.schellbachWhite} />
        </mesh>
      ))}
      <mesh position={[0, 0.06, 0.0465]}>
        <boxGeometry args={[0.001, 0.078, 0.0004]} />
        <meshBasicMaterial color={BENCH_COLORS.schellbachWhite} />
      </mesh>
    </group>
  );
}

/** Curved paper pH test strip draped over the beaker rim: dry top, stained bottom. */
export function CurvedPhStrip({
  stainColor,
  wetClear,
}: {
  readonly stainColor: string;
  readonly wetClear: boolean;
}) {
  return (
    <group position={[0, 0, 0.012]}>
      <mesh castShadow>
        <Sweep flat={PAPER} path={DRY_STRIP} radius={0.006} />
        <meshStandardMaterial
          color={INSTRUMENT_COLORS.paper}
          roughness={0.84}
        />
      </mesh>
      <mesh castShadow>
        <Sweep flat={PAPER} path={WET_STRIP} radius={0.006} />
        <meshPhysicalMaterial
          clearcoat={0.25}
          color={wetClear ? BENCH_COLORS.ceramicTile : stainColor}
          roughness={0.48}
        />
      </mesh>
    </group>
  );
}

/** Turned borosilicate dropping pipette with rubber teat bulb and internal reagent column. */
export function DroppingPipette({
  reagentColor,
}: {
  readonly reagentColor: string;
}) {
  return (
    <group>
      <mesh castShadow>
        <Turn profile={PIPETTE_GLASS} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.04}
          color={BENCH_COLORS.glass}
          depthWrite={false}
          ior={1.473}
          opacity={0.32}
          roughness={0.06}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.068, 0]}>
        <cylinderGeometry args={[0.0038, 0.0036, 0.052, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={reagentColor}
          opacity={0.78}
          roughness={0.14}
          transparent
        />
      </mesh>
      <mesh castShadow position={[0, 0.107, 0]}>
        <Turn profile={PIPETTE_BULB} />
        <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.78} />
      </mesh>
    </group>
  );
}

/** Teardrop falling indicator droplet mesh. */
export function IndicatorDroplet({ color }: { readonly color: string }) {
  return (
    <mesh castShadow>
      <Turn profile={DROPLET} />
      <meshPhysicalMaterial
        clearcoat={1}
        clearcoatRoughness={0.05}
        color={color}
        ior={1.33}
        opacity={0.88}
        roughness={0.08}
        transparent
      />
    </mesh>
  );
}

const PH_SCALE_SWATCHES = [
  PROCESS_COLORS.acidRed,
  PROCESS_COLORS.weakAcidOrange,
  PROCESS_COLORS.electronGold,
  PROCESS_COLORS.neutralGreen,
  PROCESS_COLORS.weakBaseTeal,
  PROCESS_COLORS.alkaliBlue,
  PROCESS_COLORS.alkaliPurple,
] as const;

/** Slotted matte acrylic pH reference colour card with brass pointer sliding to current pH. */
export function PhReferenceCard({ ph }: { readonly ph: number }) {
  const normalized = Math.max(0, Math.min(1, (ph - 1) / 12));
  const pointerY = 0.019 + normalized * 0.084;

  return (
    <group>
      {/* Slotted matte acrylic stand base */}
      <mesh castShadow position={[0, 0.0055, 0]} receiveShadow>
        <boxGeometry args={[0.066, 0.011, 0.028]} />
        <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.62} />
      </mesh>
      {/* Upright reference card body */}
      <mesh castShadow position={[0, 0.064, 0]}>
        <boxGeometry args={[0.056, 0.112, 0.004]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={BENCH_COLORS.dish}
          roughness={0.45}
        />
      </mesh>
      {/* 7 pH colour swatches from pH 1 (bottom) to pH 13 (top) */}
      {Arr.map(PH_SCALE_SWATCHES, (swatch, index) => (
        <mesh key={swatch} position={[-0.004, 0.019 + index * 0.014, 0.0024]}>
          <boxGeometry args={[0.036, 0.0115, 0.0008]} />
          <meshStandardMaterial color={swatch} roughness={0.42} />
        </mesh>
      ))}
      {/* Slender brass guide rail */}
      <mesh position={[0.022, 0.062, 0.003]}>
        <cylinderGeometry args={[0.0012, 0.0012, 0.098, 12]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
      </mesh>
      {/* Sliding brass pH indicator pointer */}
      <group position={[0.022, pointerY, 0.004]}>
        <mesh>
          <cylinderGeometry args={[0.0028, 0.0028, 0.006, 16]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.22} />
        </mesh>
        <mesh position={[-0.006, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.0032, 0.008, 3]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.22} />
        </mesh>
      </group>
    </group>
  );
}
