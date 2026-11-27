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
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
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
        <SurfaceMaterial
          bump={0.02}
          coat={0.35}
          color={ARGUMENT_COLORS.rail}
          repeat={[width / 0.6, length / 0.075]}
          roughness={0.5}
          surface="wood"
        />
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
            <SurfaceMaterial
              bump={0.2}
              color={ARGUMENT_COLORS.pocket}
              repeat={[CARD.width / 0.05, CARD.depth / 0.05]}
              roughness={0.95}
              surface="cloth"
            />
          </mesh>
          <mesh
            castShadow
            position={[COLUMNS.rail, RAIL.top + 0.0006, PLATE_ROWS[index] ?? z]}
            receiveShadow
          >
            <boxGeometry args={[CARD.width - 0.012, 0.0012, PLATE - 0.006]} />
            <meshPhysicalMaterial
              clearcoat={0.4}
              clearcoatRoughness={0.25}
              color={ARGUMENT_COLORS.plate}
              metalness={0.6}
              roughness={0.4}
            />
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
          <meshStandardMaterial
            color={lit ? ARGUMENT_COLORS.lampOn : ARGUMENT_COLORS.lampOff}
            emissive={ARGUMENT_COLORS.lampOn}
            emissiveIntensity={lit ? 2.4 : 0}
            roughness={0.35}
            toneMapped={!lit}
          />
        </mesh>
      ))}
      {lit ? (
        <pointLight
          color={ARGUMENT_COLORS.lampOn}
          distance={0.3}
          intensity={0.12}
          position={[0, 0.05, 0]}
        />
      ) : null}
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
      <SurfaceMaterial
        bump={0.25}
        color={ARGUMENT_COLORS.tray}
        repeat={[width / 0.06, depth / 0.06]}
        roughness={0.95}
        surface="cloth"
      />
    </RoundedBox>
  );
}
