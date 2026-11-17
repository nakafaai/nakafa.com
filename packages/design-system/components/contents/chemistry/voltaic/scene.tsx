import { RoundedBox } from "@react-three/drei";
import {
  ColumnLiquid,
  LabBench,
} from "@repo/design-system/components/contents/chemistry/bench";
import {
  BEAKER_RADIUS,
  Beaker,
  ELECTRODE_BOTTOM,
  ELECTRODE_THICKNESS,
  ELECTRODE_WIDTH,
  Lead,
  LIQUID_HEIGHT,
} from "@repo/design-system/components/contents/chemistry/electrolysis/apparatus";
import {
  BATTERY_Y,
  ELECTRODE_TOP,
  TERMINAL_OFFSET,
} from "@repo/design-system/components/contents/chemistry/electrolysis/circuit";
import { getElectrolysisColors } from "@repo/design-system/components/contents/chemistry/electrolysis/color";
import {
  halfCell,
  type Metal,
} from "@repo/design-system/components/contents/chemistry/voltaic/cell";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";

/** Metres per scene unit, the same bench scale as the electrolysis lab. */
const SCENE_SCALE = 0.1;

/** How far each half-cell's beaker stands from the middle, in scene units. */
const APART = 1.1;

/** Where each electrode stands inside its beaker, out from the middle. */
const ELECTRODE_X = APART + 0.18;

/** Where each leg of the salt bridge dips, in from the middle of its beaker. */
const BRIDGE_X = APART - 0.2;

/** The salt bridge's top and its tube's radius. */
const BRIDGE_TOP = 1.2;
const BRIDGE_RADIUS = 0.07;

/** The colour of each metal's plate, from the real metal. */
const METAL_COLOR = {
  copper: INSTRUMENT_COLORS.copper,
  iron: CAR_COLORS.castIron,
  magnesium: INSTRUMENT_COLORS.aluminium,
  silver: INSTRUMENT_COLORS.silver,
  zinc: getColor("ZINC"),
} satisfies Record<Metal, string>;

/** The colour of each metal's solution: copper(II) blue, iron(II) pale green, the rest clear. */
const SOLUTION_COLOR = {
  copper: REAGENT_COLORS.copperSulfate,
  iron: REAGENT_COLORS.ironPaleGreen,
  magnesium: REAGENT_COLORS.solution,
  silver: REAGENT_COLORS.solution,
  zinc: REAGENT_COLORS.solution,
} satisfies Record<Metal, string>;

/**
 * A chemical cell at bench scale: two beakers, each a metal plate in a
 * solution of its own ions, joined by a salt bridge, with a voltmeter in the
 * external circuit and electrons running through it from the negative
 * terminal to the positive. When the products show, the negative plate wears
 * thin, the positive plate takes a coat of its metal, and the voltmeter
 * reads the cell's voltage.
 */
export function ChemicalCellScene({
  children,
  reading,
  showProducts,
  voltmeter,
}: {
  readonly children: ReactNode;
  readonly reading: string;
  readonly showProducts: boolean;
  readonly voltmeter: string;
}) {
  const colors = getElectrolysisColors();
  const leads = [
    [
      [-ELECTRODE_X, ELECTRODE_TOP, 0],
      [-ELECTRODE_X, BATTERY_Y, 0],
      [-TERMINAL_OFFSET, BATTERY_Y, 0],
    ],
    [
      [TERMINAL_OFFSET, BATTERY_Y, 0],
      [ELECTRODE_X, BATTERY_Y, 0],
      [ELECTRODE_X, ELECTRODE_TOP, 0],
    ],
  ] as const;

  return (
    <group>
      <LabBench width={3} />
      <group position={[0, 0, 0.14]} scale={SCENE_SCALE}>
        {children}
        <SaltBridge />
        <RoundedBox
          args={[TERMINAL_OFFSET * 2, 0.4, 0.16]}
          castShadow
          position={[0, BATTERY_Y, 0]}
          radius={0.04}
          smoothness={4}
        >
          <meshPhysicalMaterial
            clearcoat={0.35}
            color={BENCH_COLORS.meterBody}
            roughness={0.5}
          />
        </RoundedBox>
        <mesh position={[0, BATTERY_Y + 0.02, 0.081]}>
          <planeGeometry args={[TERMINAL_OFFSET * 1.4, 0.2]} />
          <meshStandardMaterial
            color={BENCH_COLORS.lcd}
            emissive={BENCH_COLORS.lcdGlow}
            roughness={0.3}
          />
        </mesh>
        <ThreeLabel
          color={BENCH_COLORS.meterInk}
          fontSize="compact"
          outlineColor={BENCH_COLORS.meterHalo}
          outlineWidth={0.003}
          position={[0, BATTERY_Y, 0.09]}
        >
          {showProducts ? <InlineMath math={reading} /> : voltmeter}
        </ThreeLabel>
        {Arr.map(leads, (lead, index) => (
          <Lead
            colors={colors}
            key={String(index)}
            lead={lead}
            sheath={index === 0 ? BENCH_COLORS.leadBlack : BENCH_COLORS.leadRed}
          />
        ))}
      </group>
    </group>
  );
}

/** One half-cell: a beaker of the metal's ion solution with the metal's plate in it. */
export function HalfCell({
  metal,
  showProducts,
  side,
}: {
  readonly metal: Metal;
  readonly showProducts: boolean;
  readonly side: -1 | 1;
}) {
  const height = ELECTRODE_TOP - ELECTRODE_BOTTOM;
  const submerged = LIQUID_HEIGHT - ELECTRODE_BOTTOM;
  const wears = showProducts && side === -1;
  const coated = showProducts && side === 1;
  const { ion, symbol } = halfCell(metal);

  return (
    <group position={[side * APART, 0, 0]}>
      <Beaker colors={getElectrolysisColors()} />
      <ColumnLiquid
        bottom={0.01}
        color={SOLUTION_COLOR[metal]}
        level={LIQUID_HEIGHT + 0.01}
        opacity={metal === "copper" ? 0.5 : 0.28}
        radius={BEAKER_RADIUS - 0.012}
      />
      <group position={[side * (ELECTRODE_X - APART), 0, 0]}>
        <mesh
          castShadow
          position={[0, ELECTRODE_BOTTOM + height / 2, 0]}
          scale={[wears ? 0.55 : 1, 1, 1]}
        >
          <boxGeometry args={[ELECTRODE_THICKNESS, height, ELECTRODE_WIDTH]} />
          <MetalMaterial color={METAL_COLOR[metal]} />
        </mesh>
        {coated ? (
          <mesh position={[0, ELECTRODE_BOTTOM + submerged / 2, 0]}>
            <boxGeometry
              args={[
                ELECTRODE_THICKNESS + 0.03,
                submerged,
                ELECTRODE_WIDTH + 0.03,
              ]}
            />
            <MetalMaterial color={METAL_COLOR[metal]} roughness={0.6} />
          </mesh>
        ) : null}
        <ThreeLabel
          anchorX={side === -1 ? "right" : "left"}
          color={ORIGIN_COLOR.LIGHT}
          fontSize="compact"
          gap={0.004}
          outlineColor={ORIGIN_COLOR.DARK}
          outlineWidth={0.006}
          position={[side * 0.08, ELECTRODE_TOP - 0.02, 0.1]}
        >
          <InlineMath math={side === -1 ? "(-)" : "(+)"} />
        </ThreeLabel>
      </group>
      <ThreeLabel
        anchorY="top"
        color={ORIGIN_COLOR.LIGHT}
        fontSize="compact"
        outlineColor={ORIGIN_COLOR.DARK}
        outlineWidth={0.006}
        position={[0, -0.06, BEAKER_RADIUS]}
      >
        <InlineMath math={`${symbol}\\,|\\,${ion}\\mathrm{(aq)}`} />
      </ThreeLabel>
    </group>
  );
}

/** A salt bridge: a glass U-tube of electrolyte dipping into both beakers. */
function SaltBridge() {
  const leg = BRIDGE_TOP - 0.3;
  return (
    <group>
      {Arr.map([-BRIDGE_X, BRIDGE_X], (x) => (
        <mesh key={x} position={[x, 0.3 + leg / 2, 0]}>
          <cylinderGeometry args={[BRIDGE_RADIUS, BRIDGE_RADIUS, leg, 20]} />
          <GlassMaterial color={BENCH_COLORS.glass} />
        </mesh>
      ))}
      <mesh position={[0, BRIDGE_TOP, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry
          args={[
            BRIDGE_RADIUS,
            BRIDGE_RADIUS,
            BRIDGE_X * 2 + BRIDGE_RADIUS * 2,
            20,
          ]}
        />
        <GlassMaterial color={BENCH_COLORS.glass} />
      </mesh>
    </group>
  );
}
