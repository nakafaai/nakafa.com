import { PrintFace } from "@repo/design-system/components/three/print/layer";
import { words } from "@repo/design-system/components/three/print/sheet";
import type { Placement } from "@repo/design-system/components/three/repeat";
import { Repeat } from "@repo/design-system/components/three/repeat";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { useMemo } from "react";

/**
 * What is engraved and inked on an instrument: its graduation marks and its
 * numerals. This file is the one seam between the instruments and how a
 * scale is printed, so the instruments never draw ink themselves. A mark is
 * a groove of real geometry, exact at every zoom; a numeral is printed
 * through the print module, which draws it again as sharp as it is seen.
 */

/** How wide one character is next to its height, with room to spare. */
const ADVANCE = 0.66;

/** How tall the type's em is next to the height of the numeral's line. */
const EM = 0.9;

/**
 * The ink-filled graduation marks of one scale, drawn in a single call. Each
 * placement is one mark: where it stands, how it turns, and its width,
 * length and depth as its scale.
 *
 * @param placements - The marks, from the scale builders
 * @param ink - The colour of the ink
 */
export function Marks({
  ink = INSTRUMENT_COLORS.scaleInk,
  placements,
}: {
  readonly ink?: string;
  readonly placements: readonly Placement[];
}) {
  return (
    <Repeat placements={placements} shadows={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={ink} roughness={0.82} />
    </Repeat>
  );
}

/**
 * One numeral or legend engraved beside a scale, `height` tall, centred on
 * `at` and lying in the plane its `turn` gives.
 *
 * @param at - Where the middle of the numeral stands
 * @param height - How tall the numeral's line is
 * @param ink - The colour of the ink
 * @param text - The numeral
 * @param turn - How the numeral's plane turns, as Euler angles
 */
export function Numeral({
  at,
  height,
  ink = INSTRUMENT_COLORS.scaleInk,
  text,
  turn = [0, 0, 0],
}: {
  readonly at: readonly [number, number, number];
  readonly height: number;
  readonly ink?: string;
  readonly text: string;
  readonly turn?: readonly [number, number, number];
}) {
  const sheet = useMemo(
    () => ({
      height,
      marks: [
        words({ at: [0, 0], ink, size: height * EM, text, weight: 600 }),
      ],
      width: height * (text.length * ADVANCE + 0.4),
    }),
    [height, ink, text]
  );

  return (
    <group position={[at[0], at[1], at[2]]} rotation={[turn[0], turn[1], turn[2]]}>
      <PrintFace sheet={sheet} stock="engraving" />
    </group>
  );
}
