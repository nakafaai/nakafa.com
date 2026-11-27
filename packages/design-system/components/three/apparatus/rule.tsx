import { Matter } from "@repo/design-system/components/three/matter/material";
import { PrintFace } from "@repo/design-system/components/three/print/layer";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { Array as Arr } from "effect";

/** How thick the board of a rule is. */
const THICK = 0.02;

/** How high above the bench a rule on its edge is held by its feet, and how far in from each end a foot stands. */
const LIFT = 0.02;
const INSET = 0.25;

/** The block a rule on its end stands in: how wide, how tall and how deep it is. */
const FOOT = { deep: 0.3, tall: 0.1, wide: 0.42 } as const;

/** How far into its block a rule on its end is let. */
const LET = 0.04;

/** One slotted oak foot under a rule on its edge. */
function Foot() {
  return (
    <mesh castShadow position={[0, 0.03, 0]} receiveShadow>
      <boxGeometry args={[0.12, 0.06, 0.2]} />
      <Matter of="oak" />
    </mesh>
  );
}

/**
 * A wooden rule standing on the bench at the origin, as large as the sheet
 * printed on its face toward the reader. On its `edge` it lies along x in
 * two slotted feet, for a distance along the bench; on its `end` it stands
 * upright in a block, for a height.
 *
 * @param sheet - The scale printed on its face, which also sets its length and width
 * @param stands - Whether it lies on its edge or stands on its end
 */
export function Rule({
  sheet,
  stands,
}: {
  readonly sheet: Sheet;
  readonly stands: "edge" | "end";
}) {
  const rise =
    stands === "edge"
      ? LIFT + sheet.height / 2
      : FOOT.tall - LET + sheet.height / 2;

  return (
    <group>
      <mesh castShadow position={[0, rise, 0]} receiveShadow>
        <boxGeometry args={[sheet.width, sheet.height, THICK]} />
        <Matter of="maple" />
      </mesh>
      <group position={[0, rise, THICK / 2 + 0.001]}>
        <PrintFace sheet={sheet} stock="ink" />
      </group>
      {stands === "edge" ? (
        Arr.map([-1, 1], (side) => (
          <group key={side} position={[side * (sheet.width / 2 - INSET), 0, 0]}>
            <Foot />
          </group>
        ))
      ) : (
        <mesh castShadow position={[0, FOOT.tall / 2, 0]} receiveShadow>
          <boxGeometry args={[FOOT.wide, FOOT.tall, FOOT.deep]} />
          <Matter of="oak" />
        </mesh>
      )}
    </group>
  );
}
