import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import { Sweep, Turn } from "@repo/design-system/components/three/form/part";
import type { Path } from "@repo/design-system/components/three/form/path";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import {
  fillRise,
  graduationSheet,
} from "@repo/design-system/components/three/print/graduation";
import { PrintSleeve } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

export const LEFT_BEAKER_X = -0.155;
export const RIGHT_BEAKER_X = 0.155;
export const BEAKER_Z = 0.06;
export const ANODE_X = LEFT_BEAKER_X - 0.022;
export const CATHODE_X = RIGHT_BEAKER_X + 0.022;
export const CLIP_Y = 0.144;

const LARGE_BEAKER_WALL = [
  [0, 0],
  [0.044, 0],
  [0.048, 0.0045],
  [0.048, 0.092],
  [0.0512, 0.0965],
  [0.0492, 0.098],
  [0.0454, 0.092],
  [0.0454, 0.0055],
  [0.042, 0.0042],
  [0, 0.0042],
] as const;

/** The inner radius of a half-cell beaker and the height of its inner floor, in metres. */
const BEAKER_BORE = { floor: 0.0055, radius: 0.0454 } as const;

/**
 * The scale fired on a half-cell beaker: 100 to 400 mL, each mark at the
 * height a beaker of this bore holds that much, under its nominal capacity.
 */
const BEAKER_SCALE = { from: 100, major: 100, minor: 50, to: 400 } as const;

function createElectrodeGeometry() {
  const halfW = 0.0115;
  const halfH = 0.055;
  const shape = new Shape();
  shape.moveTo(-halfW, -halfH);
  shape.lineTo(halfW, -halfH);
  shape.lineTo(halfW, halfH);
  shape.lineTo(-halfW, halfH);
  shape.closePath();
  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.0009,
    bevelThickness: 0.0009,
    depth: 0.0036,
  });
  geo.translate(0, 0, -0.0018);
  return geo;
}

const LEFT_LEG = LEFT_BEAKER_X + 0.02;
const RIGHT_LEG = RIGHT_BEAKER_X - 0.02;

/** The inverted borosilicate U-tube salt bridge between the two electrolytes. */
export const SALT_BRIDGE: Path = [
  [LEFT_LEG, 0.044, BEAKER_Z],
  [LEFT_LEG, 0.114, BEAKER_Z],
  [LEFT_LEG + 0.032, 0.148, BEAKER_Z],
  [0, 0.156, BEAKER_Z],
  [RIGHT_LEG - 0.032, 0.148, BEAKER_Z],
  [RIGHT_LEG, 0.114, BEAKER_Z],
  [RIGHT_LEG, 0.044, BEAKER_Z],
];

/** Graduated borosilicate half-cell beaker on a white ceramic tile with electrolyte meniscus. */
export function HalfCellBeaker({
  liquidColor,
  liquidOpacity,
  x,
}: {
  readonly liquidColor: string;
  readonly liquidOpacity: number;
  readonly x: number;
}) {
  const format = usePrintNumber();
  const markings = useMemo(
    () =>
      graduationSheet(
        {
          caption: `${format(500, 0)} mL`,
          ink: BENCH_COLORS.schellbachWhite,
          rise: fillRise(BEAKER_BORE.radius),
          scale: BEAKER_SCALE,
          size: 0.0068,
        },
        format
      ),
    [format]
  );

  return (
    <group position={[x, 0, BEAKER_Z]}>
      {/* White ceramic bench pad */}
      <mesh castShadow position={[0, 0.004, 0]} receiveShadow>
        <boxGeometry args={[0.126, 0.008, 0.126]} />
        <meshPhysicalMaterial
          clearcoat={0.28}
          clearcoatRoughness={0.35}
          color={BENCH_COLORS.ceramicTile}
          roughness={0.48}
        />
      </mesh>
      {/* Electrolyte with concave meniscus */}
      <group position={[0, 0.008, 0]}>
        <ColumnLiquid
          bottom={0.005}
          color={liquidColor}
          level={0.068}
          opacity={liquidOpacity}
          radius={0.0445}
        />
        {/* Borosilicate beaker wall */}
        <mesh castShadow renderOrder={2}>
          <Turn profile={LARGE_BEAKER_WALL} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.28} />
        </mesh>
        <mesh position={[0, 0.0968, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.0496, 0.0014, 10, 56]} />
          <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.58} />
        </mesh>
        {/* Fired white enamel graduations, each at the height the beaker holds that volume */}
        <group
          position={[
            0,
            BEAKER_BORE.floor +
              ((BEAKER_SCALE.from + BEAKER_SCALE.to) / 2) *
                fillRise(BEAKER_BORE.radius),
            0,
          ]}
        >
          <PrintSleeve radius={0.048} sheet={markings} stock="enamel" />
        </group>
      </group>
    </group>
  );
}

/** Brushed bevelled metal electrode strip topped with an insulated crocodile clip and brass nut. */
export function ElectrodeAssembly({
  clipColor,
  metalColor,
  x,
}: {
  readonly clipColor: string;
  readonly metalColor: string;
  readonly x: number;
}) {
  const plateGeo = useMemo(createElectrodeGeometry, []);
  useEffect(() => () => plateGeo.dispose(), [plateGeo]);

  return (
    <group position={[x, 0, BEAKER_Z]}>
      {/* Brushed bevelled metallic electrode strip */}
      <mesh
        castShadow
        geometry={plateGeo}
        position={[0, 0.079, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <MetalMaterial color={metalColor} roughness={0.26} />
      </mesh>
      {/* Crocodile clip jaws */}
      <mesh castShadow position={[0, 0.135, 0]}>
        <boxGeometry args={[0.009, 0.014, 0.011]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.2} />
      </mesh>
      {/* Insulated red or black clip sleeve */}
      <mesh castShadow position={[0, CLIP_Y + 0.002, 0]}>
        <cylinderGeometry args={[0.0058, 0.0068, 0.018, 16]} />
        <meshStandardMaterial color={clipColor} roughness={0.48} />
      </mesh>
      {/* Brass binding nut */}
      <mesh position={[0, CLIP_Y + 0.012, 0]}>
        <cylinderGeometry args={[0.0044, 0.0044, 0.005, 6]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
      </mesh>
    </group>
  );
}

/** Curved borosilicate inverted U-tube salt bridge with inner KNO3 agar gel and cotton-wool plugs. */
export function InvertedUTubeBridge() {
  return (
    <group>
      {/* Translucent KNO3 agar gel inside U-tube */}
      <mesh renderOrder={1}>
        <Sweep path={SALT_BRIDGE} radius={0.0072} />
        <meshPhysicalMaterial
          color={PROCESS_COLORS.saltBridgeWhite}
          depthWrite={false}
          opacity={0.42}
          roughness={0.35}
          transparent
        />
      </mesh>
      {/* Outer borosilicate glass U-tube */}
      <mesh castShadow renderOrder={2}>
        <Sweep ends="open" path={SALT_BRIDGE} radius={0.0096} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.32} />
      </mesh>
      {/* White cotton-wool plugs at both immersed tips */}
      {Arr.map([LEFT_LEG, RIGHT_LEG] as const, (tipX) => (
        <mesh key={tipX} position={[tipX, 0.042, BEAKER_Z]}>
          <sphereGeometry args={[0.009, 14, 12]} />
          <meshStandardMaterial
            color={PROCESS_COLORS.ceramicIvory}
            roughness={0.94}
          />
        </mesh>
      ))}
    </group>
  );
}
