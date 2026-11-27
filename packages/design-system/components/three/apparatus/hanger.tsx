import { slottedStack } from "@repo/design-system/components/three/apparatus/mass";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { PrintSleeve } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { words } from "@repo/design-system/components/three/print/sheet";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { Shape } from "three";

/** The radius of a slotted mass, the width of its slot, and how far its edges are rounded. */
const DISC = { bevel: 0.003, radius: 0.13, slot: 0.03 } as const;

/** How thick the hanger's plate is, and how much of its rod stands clear above a full stack. */
const PLATE = 0.024;
const CLEAR = 0.16;

/** The outline of a slotted mass seen from above: a disc with a slot to its middle, where the hanger's rod goes. */
function discOutline() {
  const outline = new Shape();
  const half = DISC.slot / 2;
  const open = Math.asin(half / DISC.radius);
  outline.moveTo(DISC.radius * Math.cos(open), half);
  outline.absarc(0, 0, DISC.radius, open, 2 * Math.PI - open, false);
  outline.lineTo(0, -half);
  outline.absarc(0, 0, half, -Math.PI / 2, Math.PI / 2, true);
  outline.closePath();
  return outline;
}

/** One cast iron slotted mass, its underside at the origin, with its weight stamped on its edge. */
function Disc({
  thick,
  weight,
}: {
  readonly thick: number;
  readonly weight: number;
}) {
  const format = usePrintNumber();
  const outline = useMemo(discOutline, []);
  const stamp = useMemo(
    () => ({
      height: thick,
      marks: [
        words({
          at: [0, 0],
          ink: INSTRUMENT_COLORS.paper,
          size: Math.min(thick * 0.62, 0.036),
          text: `${format(weight, 0)} N`,
        }),
      ],
      width: 0.16,
    }),
    [format, thick, weight]
  );

  return (
    <group>
      <mesh
        castShadow
        position={[0, DISC.bevel, 0]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
      >
        <extrudeGeometry
          args={[
            outline,
            {
              bevelEnabled: true,
              bevelSegments: 2,
              bevelSize: DISC.bevel,
              bevelThickness: DISC.bevel,
              curveSegments: 40,
              depth: thick - DISC.bevel * 2 - 0.002,
            },
          ]}
        />
        <Matter of="iron" />
      </mesh>
      <group position={[0, thick / 2, 0]}>
        <PrintSleeve
          radius={DISC.radius + DISC.bevel}
          sheet={stamp}
          stock="engraving"
        />
      </group>
    </group>
  );
}

/**
 * A brass mass hanger that hangs from the origin with the slotted masses
 * that make up `load` newtons on its plate, the heaviest lowest. Each mass
 * is turned a little from the one under it, as a hand leaves them, and its
 * slot faces away from the reader so the stamp on its edge can be read.
 *
 * @param load - The load on the hanger, in newtons
 */
export function Hanger({ load }: { readonly load: number }) {
  const stack = slottedStack(load);
  const rod = CLEAR + stack.height;

  return (
    <group>
      <mesh castShadow position={[0, -0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.02, 0.007, 10, 28]} />
        <Matter of="brass" />
      </mesh>
      <mesh castShadow position={[0, -0.04 - rod / 2, 0]}>
        <cylinderGeometry args={[0.009, 0.009, rod, 14]} />
        <Matter of="brass" />
      </mesh>
      <mesh castShadow position={[0, -0.04 - rod - PLATE / 2, 0]}>
        <cylinderGeometry args={[DISC.radius, DISC.radius, PLATE, 48]} />
        <Matter of="brass" />
      </mesh>
      {Arr.map(stack.masses, (mass, index) => (
        <group
          key={mass.base}
          position={[0, -0.04 - rod + mass.base, 0]}
          rotation={[0, ((index % 3) - 1) * 0.3, 0]}
        >
          <Disc thick={mass.thick} weight={mass.weight} />
        </group>
      ))}
    </group>
  );
}
