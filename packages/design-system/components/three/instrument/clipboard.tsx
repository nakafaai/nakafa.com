import { RoundedBox } from "@react-three/drei";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { PrintFace } from "@repo/design-system/components/three/print/layer";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";

/** How far the board runs past the sheet: to either side, under it, and over it for the clip, in millimetres. */
const MARGIN = { foot: 8, head: 24, side: 8 } as const;

/** How thick the hardboard is, in millimetres. */
const THICK = 3;

/** The black enamel of the sprung clip. */
function Enamel() {
  return (
    <SurfaceMaterial
      coat={0.4}
      color={INSTRUMENT_COLORS.gripPad}
      repeat={[6, 1]}
      roughness={0.5}
      surface="paint"
    />
  );
}

/**
 * A results board: a hardboard clipboard with its black sprung clip, holding
 * one printed sheet. The board is cut to the sheet, so the author names the
 * sheet alone, in millimetres.
 *
 * It is drawn in scene units, standing on its bottom edge at the origin with
 * the sheet facing +z. An author leans it on a block or lays it on the
 * bench.
 *
 * @param sheet - What is printed on the sheet, in millimetres
 */
export function Clipboard({ sheet }: { readonly sheet: Sheet }) {
  const wide = sheet.width + MARGIN.side * 2;
  const tall = sheet.height + MARGIN.foot + MARGIN.head;

  return (
    <group scale={MILLIMETRE}>
      <RoundedBox
        args={[wide, tall, THICK]}
        castShadow
        position={[0, tall / 2, -THICK / 2]}
        radius={1.2}
        receiveShadow
        smoothness={3}
      >
        <SurfaceMaterial
          color={APPARATUS_COLORS.oakDark}
          repeat={[3, 2]}
          roughness={0.7}
          surface="wood"
        />
      </RoundedBox>
      <group position={[0, MARGIN.foot + sheet.height / 2, 0.25]}>
        <PrintFace sheet={sheet} stock="paper" />
      </group>
      <RoundedBox
        args={[74, 15, 5]}
        castShadow
        position={[0, tall - 11, 2.4]}
        radius={1.6}
        smoothness={4}
      >
        <Enamel />
      </RoundedBox>
      <mesh
        castShadow
        position={[0, tall - 5, 4]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[3.2, 3.2, 62, 24]} />
        <Enamel />
      </mesh>
    </group>
  );
}
