import { RoundedBox } from "@react-three/drei";
import {
  CARD,
  COLUMNS,
  EXTENT,
  PITCH,
  PLATE,
  PLATE_ROWS,
  RAIL,
  RIM,
  ROWS,
  TAB,
  TRAY,
} from "@repo/design-system/components/contents/mathematics/argument/layout";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { Shine } from "@repo/design-system/components/three/matter/shine";
import { ARGUMENT_COLORS } from "@repo/design-system/lib/material/argument";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";

/** The print size of a slot's name on its brass plate, in metres. */
const NAME_SIZE = 0.0105;

/** How far the felt of a pocket reaches past the card it holds. */
const POCKET_MARGIN = 0.002;

/** The lamp strip round the conclusion's pocket: how wide its bars are. */
const LAMP_BAR = 0.0024;

/**
 * The oiled oak rail the chain is built on: three felt pockets down its
 * length, first premise farthest, each under a brass plate that names its
 * slot, and a lamp strip round the conclusion's pocket that lights once the
 * conclusion follows.
 */
export function Rail({
  children,
  names,
}: {
  readonly children?: ReactNode;
  readonly names: readonly [string, string, string];
}) {
  const length = EXTENT.depth;
  const width = CARD.width + 2 * RIM;
  return (
    <group>
      <RoundedBox
        args={[width, RAIL.top, length]}
        castShadow
        position={[COLUMNS.rail, RAIL.top / 2, EXTENT.middle.z]}
        radius={0.003}
        receiveShadow
        smoothness={3}
      >
        <Matter of="oak" />
      </RoundedBox>
      {Arr.map(ROWS, (z, index) => (
        <group key={z}>
          <mesh
            position={[COLUMNS.rail, (RAIL.top + RAIL.pocket) / 2, z]}
            receiveShadow
          >
            <boxGeometry
              args={[
                CARD.width + 2 * POCKET_MARGIN,
                RAIL.pocket - RAIL.top,
                CARD.depth + 2 * POCKET_MARGIN,
              ]}
            />
            <Matter color={ARGUMENT_COLORS.pocket} of="felt" />
          </mesh>
          <mesh
            castShadow
            position={[COLUMNS.rail, RAIL.top + 0.0006, PLATE_ROWS[index] ?? z]}
            receiveShadow
          >
            <boxGeometry args={[CARD.width - 0.012, 0.0012, PLATE - 0.006]} />
            <Matter color={ARGUMENT_COLORS.plate} of="enamel" />
          </mesh>
          <ThreeLabel
            color={ARGUMENT_COLORS.plateInk}
            fontSize={NAME_SIZE}
            outlineColor={ARGUMENT_COLORS.plate}
            outlineWidth={NAME_SIZE * 0.04}
            position={[COLUMNS.rail, RAIL.top + 0.0013, PLATE_ROWS[index] ?? z]}
          >
            <span className="font-medium">{names[index]}</span>
          </ThreeLabel>
        </group>
      ))}
      {children}
    </group>
  );
}

/** How brightly the lamp strip shines once the conclusion follows: a strip of lamps, far brighter than one indicator. */
const LAMP_GLOW = 3.5;

/**
 * The lamp strip round the conclusion's pocket: four bars of smoked glass,
 * dark until the conclusion follows, then lit warm, with a soft light over
 * the card it frames.
 */
export function Lamp({ lit }: { readonly lit: boolean }) {
  const z = ROWS[2];
  const across = CARD.width / 2 + POCKET_MARGIN + LAMP_BAR / 2;
  const down = CARD.depth / 2 + POCKET_MARGIN + LAMP_BAR / 2;
  const bars = [
    { at: [0, -down], size: [2 * across + LAMP_BAR, LAMP_BAR] },
    { at: [0, down], size: [2 * across + LAMP_BAR, LAMP_BAR] },
    { at: [-across, 0], size: [LAMP_BAR, 2 * down - LAMP_BAR] },
    { at: [across, 0], size: [LAMP_BAR, 2 * down - LAMP_BAR] },
  ] as const;
  return (
    <group position={[COLUMNS.rail, RAIL.top, z]}>
      {Arr.map(bars, (bar) => (
        <mesh
          key={`${bar.at[0]}-${bar.at[1]}`}
          position={[bar.at[0], 0.0007, bar.at[1]]}
        >
          <boxGeometry args={[bar.size[0], 0.0014, bar.size[1]]} />
          <Matter
            color={lit ? ARGUMENT_COLORS.lampOn : ARGUMENT_COLORS.lampOff}
            glow={lit ? LAMP_GLOW : 0}
            of="epoxy"
          />
        </mesh>
      ))}
      <Shine
        color={ARGUMENT_COLORS.lampOn}
        glow={lit ? LAMP_GLOW : 0}
        of="epoxy"
        position={[0, 0.05, 0]}
      />
    </group>
  );
}

/** The charcoal felt tray the hand lies on, beside the rail. */
export function Tray() {
  const width = CARD.width + 2 * RIM + TAB.reach;
  const depth = 2 * PITCH + CARD.depth + 2 * RIM;
  return (
    <RoundedBox
      args={[width, TRAY.top, depth]}
      position={[COLUMNS.hand + TAB.reach / 2, TRAY.top / 2, 0]}
      radius={0.0018}
      receiveShadow
      smoothness={3}
    >
      <Matter color={ARGUMENT_COLORS.tray} of="felt" />
    </RoundedBox>
  );
}
