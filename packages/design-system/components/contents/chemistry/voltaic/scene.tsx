import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  BEAKER_RADIUS,
  Beaker,
  Deposit,
  Electrons,
  Plate,
} from "@repo/design-system/components/contents/chemistry/electrolysis/apparatus";
import {
  BENCH,
  ELECTRODE_TOP,
} from "@repo/design-system/components/contents/chemistry/electrolysis/circuit";
import { getElectrolysisColors } from "@repo/design-system/components/contents/chemistry/electrolysis/color";
import {
  BENCH_LABEL,
  BENCH_LABEL_OUTLINE,
} from "@repo/design-system/components/contents/chemistry/label";
import type { Metal } from "@repo/design-system/components/contents/chemistry/voltaic/cell";
import { halfCell } from "@repo/design-system/components/contents/chemistry/voltaic/cell";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Lead } from "@repo/design-system/components/three/apparatus/lead";
import {
  METER_POSTS,
  Readout,
} from "@repo/design-system/components/three/apparatus/meter";
import type { Lead as LeadAsk } from "@repo/design-system/components/three/apparatus/route";
import { Borosilicate } from "@repo/design-system/components/three/apparatus/vessel";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { Sweep } from "@repo/design-system/components/three/form/part";
import type { Path } from "@repo/design-system/components/three/form/path";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";

/** How far each half-cell's beaker stands from the middle, in scene units. */
const APART = 1.1;

/** Where each electrode stands inside its beaker, out from the middle. */
const ELECTRODE_X = APART + 0.18;

/** Where each leg of the salt bridge dips, in from the middle of its beaker. */
const BRIDGE_X = APART - 0.2;

/** The salt bridge's top, how low its legs dip into the solutions, and its tube's radius. */
const BRIDGE_TOP = 1.2;
const BRIDGE_DIP = 0.3;
const BRIDGE_RADIUS = 0.07;

/** The colour of each metal's plate, from the real metal. */
const METAL_COLOR = {
  copper: INSTRUMENT_COLORS.copper,
  iron: CAR_COLORS.castIron,
  magnesium: INSTRUMENT_COLORS.aluminium,
  silver: INSTRUMENT_COLORS.silver,
  zinc: getColor("ZINC"),
} satisfies Record<Metal, string>;

/** Where the voltmeter stands, in front of the cell under the salt bridge, in metres, and how large it is. */
const METER = { at: [0, 0, 0.15], scale: 0.8 } as const;

/** Where one of the voltmeter's posts is, in metres from the middle of the cell. */
function postAt(post: (typeof METER_POSTS)[number]) {
  return [
    METER.at[0] + post[0] * METER.scale,
    post[1] * METER.scale,
    METER.at[2] + post[2] * METER.scale,
  ] as const;
}

/** The leads of the external circuit, each written the way electrons travel: out of the negative plate, into the positive. */
const LEADS: readonly LeadAsk[] = [
  {
    ends: ["clip", "plug"],
    from: [-ELECTRODE_X * BENCH, ELECTRODE_TOP * BENCH, 0],
    lift: 0.04,
    to: postAt(METER_POSTS[0]),
  },
  {
    ends: ["plug", "clip"],
    from: postAt(METER_POSTS[1]),
    lift: 0.04,
    to: [ELECTRODE_X * BENCH, ELECTRODE_TOP * BENCH, 0],
  },
];

/**
 * What the camera frames, in metres from the middle of the cell: the
 * upright face of the two half-cells, the bridge and the leads. The
 * voltmeter stands in front of that face and lower than it, so the face
 * reaches below the bench by as much as the meter's foot shows under it
 * from the camera.
 */
const FRAME = {
  x: { max: 0.19, min: -0.19 },
  y: { max: 0.2, min: -0.1 },
  z: { max: 0.04, min: -0.04 },
};

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
  voltage,
  voltmeter,
}: {
  readonly children: ReactNode;
  readonly reading: string;
  readonly showProducts: boolean;
  readonly voltage: number;
  readonly voltmeter: string;
}) {
  const colors = getElectrolysisColors();

  return (
    <group>
      <CameraBounds exclude>
        <LabBench width={3} />
      </CameraBounds>
      <group position={[0, 0, -0.02]}>
        <CameraBounds bounds={FRAME}>
          <group scale={BENCH}>
            {children}
            <SaltBridge />
          </group>
          <group position={METER.at} scale={METER.scale}>
            <Readout
              digits={2}
              unit="V"
              {...(showProducts ? { reading: voltage } : {})}
            />
          </group>
          <ThreeLabel
            color={BENCH_COLORS.meterInk}
            {...BENCH_LABEL}
            outlineColor={BENCH_COLORS.meterHalo}
            outlineWidth={BENCH_LABEL_OUTLINE}
            position={[0, 0.155, 0]}
          >
            {showProducts ? <InlineMath math={reading} /> : voltmeter}
          </ThreeLabel>
          {Arr.map(LEADS, (lead, index) => (
            <group key={String(index)}>
              <Lead
                color={
                  index === 0
                    ? LABWARE_COLORS.leadBlack
                    : LABWARE_COLORS.leadRed
                }
                {...lead}
              />
              <Electrons color={colors.electron} lead={lead} />
            </group>
          ))}
        </CameraBounds>
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
  const wears = showProducts && side === -1;
  const coated = showProducts && side === 1;
  const { ion, symbol } = halfCell(metal);

  return (
    <group position={[side * APART, 0, 0]}>
      <Beaker
        color={SOLUTION_COLOR[metal]}
        strength={metal === "copper" ? 20 : 3}
      />
      <group position={[side * (ELECTRODE_X - APART), 0, 0]}>
        <Plate color={METAL_COLOR[metal]} wear={wears ? 0.55 : 1} />
        {coated ? <Deposit color={METAL_COLOR[metal]} /> : null}
        <ThreeLabel
          anchorX={side === -1 ? "right" : "left"}
          color={ORIGIN_COLOR.LIGHT}
          {...BENCH_LABEL}
          gap={0.003}
          outlineColor={ORIGIN_COLOR.DARK}
          outlineWidth={BENCH_LABEL_OUTLINE}
          position={[side * 0.08, ELECTRODE_TOP - 0.02, 0.1]}
        >
          <InlineMath math={side === -1 ? "(-)" : "(+)"} />
        </ThreeLabel>
      </group>
      <ThreeLabel
        anchorY="top"
        color={ORIGIN_COLOR.LIGHT}
        {...BENCH_LABEL}
        outlineColor={ORIGIN_COLOR.DARK}
        outlineWidth={BENCH_LABEL_OUTLINE}
        position={[side * 0.4, -0.06, BEAKER_RADIUS]}
      >
        <InlineMath math={`${symbol}\\,|\\,${ion}\\mathrm{(aq)}`} />
      </ThreeLabel>
    </group>
  );
}

/** The salt bridge's glass: up one leg, across and down the other, bent in two smooth elbows. */
const BRIDGE: Path = {
  bend: 0.22,
  kind: "route",
  points: [
    [-BRIDGE_X, BRIDGE_DIP, 0],
    [-BRIDGE_X, BRIDGE_TOP, 0],
    [BRIDGE_X, BRIDGE_TOP, 0],
    [BRIDGE_X, BRIDGE_DIP, 0],
  ],
};

/**
 * A salt bridge: an inverted glass U-tube bent in two smooth elbows, filled
 * with pale agar jelly of potassium nitrate and stopped with a cotton plug
 * at each end, a leg dipping into the solution of each beaker.
 */
function SaltBridge() {
  return (
    <group>
      <mesh renderOrder={1}>
        <Sweep path={BRIDGE} radius={BRIDGE_RADIUS * 0.78} />
        <meshPhysicalMaterial
          color={BENCH_COLORS.agar}
          depthWrite={false}
          opacity={0.6}
          roughness={0.5}
          transparent
        />
      </mesh>
      <mesh castShadow renderOrder={2}>
        <Sweep ends="open" path={BRIDGE} radius={BRIDGE_RADIUS} />
        <Borosilicate />
      </mesh>
      {Arr.map([-BRIDGE_X, BRIDGE_X], (x) => (
        <mesh key={x} position={[x, BRIDGE_DIP + 0.03, 0]} scale={[1, 1.5, 1]}>
          <sphereGeometry args={[BRIDGE_RADIUS * 0.8, 24, 16]} />
          <SurfaceMaterial
            bump={1}
            color={BENCH_COLORS.ptfe}
            repeat={[2, 2]}
            roughness={1}
            surface="cloth"
          />
        </mesh>
      ))}
    </group>
  );
}
