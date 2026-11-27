import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  BENCH,
  circuitLeads,
  ELECTRODE_TOP,
} from "@repo/design-system/components/contents/chemistry/electrolysis/circuit";
import type { ElectrolysisColors } from "@repo/design-system/components/contents/chemistry/electrolysis/color";
import {
  BENCH_LABEL,
  BENCH_LABEL_OUTLINE,
} from "@repo/design-system/components/contents/chemistry/label";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  boreAt,
  levelOf,
} from "@repo/design-system/components/three/apparatus/glass";
import { Lead } from "@repo/design-system/components/three/apparatus/lead";
import { Mote } from "@repo/design-system/components/three/apparatus/mote";
import type { Lead as LeadAsk } from "@repo/design-system/components/three/apparatus/route";
import { routeOf } from "@repo/design-system/components/three/apparatus/route";
import {
  SUPPLY_POSTS,
  Supply,
} from "@repo/design-system/components/three/apparatus/supply";
import { Vessel } from "@repo/design-system/components/three/apparatus/vessel";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import {
  placeOn,
  trackOf,
} from "@repo/design-system/components/three/form/path";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

/** The beaker of one cell and the electrolyte it holds, in millilitres. */
const CELL = { capacity: 250, kind: "beaker" } as const;
const ELECTROLYTE = 190;

/** The beaker's inner radius, in scene units. */
export const BEAKER_RADIUS = boreAt(CELL, 0.05) / BENCH;

/** How high the electrolyte stands in the beaker, in scene units. */
export const LIQUID_HEIGHT = levelOf(CELL, ELECTROLYTE) / BENCH;

/** The height of an electrode's bottom, clear of the beaker's floor. */
const ELECTRODE_BOTTOM = 0.12;

/** An electrode plate's thickness and width. */
const ELECTRODE_THICKNESS = 0.024;
const ELECTRODE_WIDTH = 0.16;

/** The motes that stand for electrons on each lead, and how fast they move. */
const ELECTRONS_PER_LEAD = 5;
const ELECTRON_SPEED = 0.16;

/** The bubbles a gas electrode gives off: how many, and each one's size, in scene units. */
const BUBBLES = Arr.makeBy(10, (index) => 0.009 + ((index * 7) % 5) * 0.0022);

/** How far behind the cells the power pack stands, and the voltage it is set to. */
const PACK_BACK = 0.17;
const PACK_VOLTS = 6;

/** Where the power pack's positive and negative posts are, in metres from the middle of the row of cells. */
const POSTS = [
  [SUPPLY_POSTS[0][0], SUPPLY_POSTS[0][1], SUPPLY_POSTS[0][2] - PACK_BACK],
  [SUPPLY_POSTS[1][0], SUPPLY_POSTS[1][1], SUPPLY_POSTS[1][2] - PACK_BACK],
] as const;

/**
 * A 250 mL borosilicate beaker of electrolyte, standing on the bench at
 * y = 0: its solution filters the light as deeply as it is strong.
 */
export function Beaker({
  color,
  strength,
}: {
  readonly color: string;
  readonly strength: number;
}) {
  return (
    <group scale={1 / BENCH}>
      <Vessel
        capacity={CELL.capacity}
        holds={{ color, strength, volume: ELECTROLYTE }}
        kind={CELL.kind}
      />
    </group>
  );
}

/**
 * One electrode: a strip cut from sheet metal and rubbed bright, or a
 * pressed graphite plate, from its bottom in the electrolyte up to where
 * its lead clips on. `wear` is how much of its thickness is left.
 */
export function Plate({
  color,
  graphite = false,
  wear = 1,
}: {
  readonly color: string;
  readonly graphite?: boolean;
  readonly wear?: number;
}) {
  const height = ELECTRODE_TOP - ELECTRODE_BOTTOM;

  return (
    <RoundedBox
      args={[ELECTRODE_THICKNESS, height, ELECTRODE_WIDTH]}
      castShadow
      position={[0, ELECTRODE_BOTTOM + height / 2, 0]}
      radius={0.006}
      scale={[wear, 1, 1]}
      smoothness={3}
    >
      {graphite ? (
        <SurfaceMaterial
          color={color}
          repeat={[1, 6]}
          roughness={0.82}
          surface="cast"
        />
      ) : (
        <SurfaceMaterial
          color={color}
          metalness={1}
          repeat={[2, 12]}
          roughness={0.34}
          surface="brushed"
        />
      )}
    </RoundedBox>
  );
}

/**
 * The metal an electrode takes on from its electrolyte: a matt, grainy coat
 * over the part of the plate that stands in the solution.
 */
export function Deposit({ color }: { readonly color: string }) {
  const submerged = LIQUID_HEIGHT - ELECTRODE_BOTTOM;

  return (
    <RoundedBox
      args={[ELECTRODE_THICKNESS + 0.022, submerged, ELECTRODE_WIDTH + 0.022]}
      position={[0, ELECTRODE_BOTTOM + submerged / 2, 0]}
      radius={0.01}
      smoothness={3}
    >
      <SurfaceMaterial
        bump={1}
        color={color}
        metalness={1}
        repeat={[2, 6]}
        roughness={0.62}
        surface="cast"
      />
    </RoundedBox>
  );
}

/** Bubbles of gas rising from an electrode's submerged face to the surface, each a film of liquid about the gas. */
export function Bubbles({ color }: { readonly color: string }) {
  const group = useRef<Group>(null);

  useFrame(({ clock }) => {
    Arr.forEach(group.current?.children ?? [], (bubble, index) => {
      const progress =
        (clock.elapsedTime * (0.28 + (index % 3) * 0.06) +
          index / BUBBLES.length) %
        1;
      bubble.position.set(
        (index % 2 === 0 ? 1 : -1) * (ELECTRODE_THICKNESS / 2 + 0.022) +
          Math.sin(progress * 9 + index) * 0.008,
        ELECTRODE_BOTTOM +
          0.04 +
          progress * (LIQUID_HEIGHT - ELECTRODE_BOTTOM - 0.06),
        ((index % 5) - 2) * 0.028
      );
    });
  });

  return (
    <CameraBounds exclude>
      <group ref={group}>
        {Arr.map(BUBBLES, (radius, index) => (
          <mesh key={String(index)}>
            <sphereGeometry args={[radius, 16, 12]} />
            <meshPhysicalMaterial
              clearcoat={1}
              clearcoatRoughness={0.05}
              color={color}
              depthWrite={false}
              ior={1.333}
              opacity={0.34}
              roughness={0.04}
              transparent
            />
          </mesh>
        ))}
      </group>
    </CameraBounds>
  );
}

/**
 * The low-voltage DC power pack a school lab runs electrolysis from,
 * standing on the bench behind the cells, with the signs of its two posts
 * and its name beside it.
 */
export function Battery({
  colors,
  label,
}: {
  readonly colors: ElectrolysisColors;
  readonly label: string;
}) {
  return (
    <group>
      <group scale={1 / BENCH}>
        <group position={[0, 0, -PACK_BACK]}>
          <Supply volts={PACK_VOLTS} />
        </group>
        <ThreeLabel
          color={colors.text}
          {...BENCH_LABEL}
          outlineColor={colors.halo}
          outlineWidth={BENCH_LABEL_OUTLINE}
          position={[POSTS[0][0] - 0.02, POSTS[0][1] + 0.012, POSTS[0][2]]}
        >
          <InlineMath math="+" />
        </ThreeLabel>
        <ThreeLabel
          color={colors.text}
          {...BENCH_LABEL}
          outlineColor={colors.halo}
          outlineWidth={BENCH_LABEL_OUTLINE}
          position={[POSTS[1][0] + 0.02, POSTS[1][1] + 0.012, POSTS[1][2]]}
        >
          <InlineMath math="-" />
        </ThreeLabel>
        <ThreeLabel
          color={colors.text}
          {...BENCH_LABEL}
          outlineColor={colors.halo}
          outlineWidth={BENCH_LABEL_OUTLINE}
          position={[0, POSTS[0][1] + 0.085, -PACK_BACK]}
        >
          {label}
        </ThreeLabel>
      </group>
    </group>
  );
}

/**
 * The leads of the cells in series, red to the power pack's positive post
 * and black for the rest, each with the electrons moving along it.
 */
export function Circuit({
  colors,
  count,
}: {
  readonly colors: ElectrolysisColors;
  readonly count: number;
}) {
  const leads = useMemo(() => circuitLeads(count, POSTS), [count]);

  return (
    <group scale={1 / BENCH}>
      {Arr.map(leads, (lead, index) => (
        <group key={String(index)}>
          <Lead
            color={
              index === 0 ? LABWARE_COLORS.leadRed : LABWARE_COLORS.leadBlack
            }
            {...lead}
          />
          <Electrons color={colors.electron} lead={lead} />
        </group>
      ))}
    </group>
  );
}

/** The electrons moving along one lead, from its first end to its second. */
export function Electrons({
  color,
  lead,
}: {
  readonly color: string;
  readonly lead: LeadAsk;
}) {
  const group = useRef<Group>(null);
  const track = useMemo(() => trackOf(routeOf(lead)), [lead]);

  useFrame(({ clock }) => {
    Arr.forEach(group.current?.children ?? [], (electron, index) => {
      placeOn(
        track,
        (clock.elapsedTime * ELECTRON_SPEED + index / ELECTRONS_PER_LEAD) % 1,
        electron.position
      );
    });
  });

  return (
    <CameraBounds exclude>
      <group ref={group}>
        {Arr.makeBy(ELECTRONS_PER_LEAD, (index) => (
          <Mote color={color} core={0.34} key={String(index)} radius={0.0058} />
        ))}
      </group>
    </CameraBounds>
  );
}
