import { RoundedBox } from "@react-three/drei";
import {
  KNOB,
  knobOf,
  panelOf,
} from "@repo/design-system/components/three/apparatus/face";
import { PrintFace } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** The pack's steel case: its width, height and depth, in metres. */
const CASE = { deep: 0.14, height: 0.094, width: 0.19 } as const;

/** How far above the bench the case stands on its feet. */
const FOOT = 0.006;

/**
 * Where the leads of a power pack meet it, the positive post first, from
 * the middle of its footprint on the bench: the top of each post, on the
 * top of its case toward the front.
 */
export const SUPPLY_POSTS = [
  [-0.05, FOOT + CASE.height + 0.022, 0.034],
  [0.05, FOOT + CASE.height + 0.022, 0.034],
] as const;

/** The pack's four feet and the six slots of the vent pressed in its top. */
const FEET = [
  [-0.078, -0.054],
  [0.078, -0.054],
  [-0.078, 0.054],
  [0.078, 0.054],
] as const;
const VENTS = Arr.makeBy(6, (slot) => -0.05 + slot * 0.012);

/** The colours the panel is printed in. */
const PANEL_INKS = {
  accent: LABWARE_COLORS.spark,
  ground: LABWARE_COLORS.packPanel,
  ink: LABWARE_COLORS.enamel,
};

/**
 * A school low-voltage DC power pack standing on the bench at y = 0, facing
 * +z: a stove-enamelled steel case on rubber feet with a pressed vent, a
 * dark printed front panel with a knurled voltage knob on its scale, a
 * rocker switch and a pilot lamp, and a red and a black 4 mm post on top
 * (`SUPPLY_POSTS`). The knob points at the voltage the pack is set to.
 *
 * @example
 * <Supply volts={6} />
 *
 * @param volts - The voltage it is set to, from 0 to 12
 */
export function Supply({ volts }: { readonly volts: number }) {
  const format = usePrintNumber();
  const panel = useMemo(() => panelOf(PANEL_INKS, format), [format]);
  const front = CASE.deep / 2;
  const middle = FOOT + CASE.height / 2;

  return (
    <group>
      {Arr.map(FEET, ([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, FOOT / 2, z]}>
          <cylinderGeometry args={[0.009, 0.01, FOOT, 20]} />
          <SurfaceMaterial
            color={LABWARE_COLORS.rubber}
            roughness={0.9}
            surface="rubber"
          />
        </mesh>
      ))}
      <RoundedBox
        args={[CASE.width, CASE.height, CASE.deep]}
        castShadow
        position={[0, middle, 0]}
        radius={0.005}
        receiveShadow
        smoothness={5}
      >
        <SurfaceMaterial
          bump={0.3}
          coat={0.25}
          color={LABWARE_COLORS.packCase}
          repeat={[3, 2]}
          roughness={0.5}
          surface="paint"
        />
      </RoundedBox>
      {Arr.map(VENTS, (z) => (
        <mesh key={z} position={[0, FOOT + CASE.height + 0.0002, z - 0.02]}>
          <boxGeometry args={[0.07, 0.0012, 0.004]} />
          <meshStandardMaterial color={LABWARE_COLORS.bezel} roughness={0.9} />
        </mesh>
      ))}
      <group position={[0, middle, front + 0.0006]}>
        <PrintFace sheet={panel} stock="ink" />
        <group position={[KNOB.at[0], KNOB.at[1], 0]}>
          <group rotation={[0, 0, knobOf(volts)]}>
            <mesh
              castShadow
              position={[0, 0, 0.008]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.0125, 0.014, 0.016, 40]} />
              <SurfaceMaterial
                coat={0.3}
                color={LABWARE_COLORS.bakelite}
                repeat={[10, 1]}
                roughness={0.5}
                surface="knurl"
              />
            </mesh>
            <mesh position={[0, 0.008, 0.0164]}>
              <boxGeometry args={[0.0014, 0.008, 0.0006]} />
              <meshStandardMaterial
                color={LABWARE_COLORS.enamel}
                roughness={0.6}
              />
            </mesh>
          </group>
        </group>
        <RoundedBox
          args={[0.02, 0.013, 0.006]}
          castShadow
          position={[-0.056, -0.012, 0.002]}
          radius={0.0015}
          rotation={[0.16, 0, 0]}
          smoothness={3}
        >
          <SurfaceMaterial
            coat={0.5}
            color={LABWARE_COLORS.dialRed}
            roughness={0.4}
            surface="plastic"
          />
        </RoundedBox>
        <mesh position={[-0.026, -0.012, 0.0018]}>
          <sphereGeometry args={[0.0032, 20, 14]} />
          <meshStandardMaterial
            color={LABWARE_COLORS.spark}
            emissive={LABWARE_COLORS.spark}
            emissiveIntensity={1.4}
            roughness={0.25}
          />
        </mesh>
      </group>
      <Terminal color={LABWARE_COLORS.leadRed} position={SUPPLY_POSTS[0]} />
      <Terminal color={LABWARE_COLORS.leadBlack} position={SUPPLY_POSTS[1]} />
    </group>
  );
}

/** A 4 mm socket post on the pack's top: a moulded collar in its colour about a nickel socket. */
function Terminal({
  color,
  position,
}: {
  readonly color: string;
  readonly position: readonly [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, -0.011, 0]}>
        <cylinderGeometry args={[0.0078, 0.0095, 0.022, 28]} />
        <SurfaceMaterial
          coat={0.4}
          color={color}
          repeat={[2, 1]}
          roughness={0.5}
          surface="plastic"
        />
      </mesh>
      <mesh position={[0, -0.0004, 0]}>
        <cylinderGeometry args={[0.0042, 0.0042, 0.0012, 20]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.nickel}
          metalness={1}
          roughness={0.26}
          surface="brushed"
        />
      </mesh>
    </group>
  );
}
