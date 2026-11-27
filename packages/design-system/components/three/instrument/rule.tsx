import {
  Marks,
  Numeral,
} from "@repo/design-system/components/three/instrument/ink";
import {
  MILLIMETRE,
  straightMarks,
} from "@repo/design-system/components/three/instrument/scale";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { Path, Shape } from "three";

/** The strip: how tall and thick it is, and how far it runs past its first and last marks. */
const STRIP = { margin: 6, tall: 26, thick: 0.9 } as const;

/** One tile of ground steel for every 12 millimetres of the strip. */
const GRAIN = [1 / 12, 1 / 12] as const;

/** The strip of a rule `long` millimetres between its end marks, with its hanging hole. */
function stripShape(long: number) {
  const shape = new Shape();
  const right = long + STRIP.margin;
  const round = 1.6;
  shape.moveTo(-STRIP.margin + round, 0);
  shape.lineTo(right - round, 0);
  shape.quadraticCurveTo(right, 0, right, -round);
  shape.lineTo(right, -STRIP.tall + round);
  shape.quadraticCurveTo(right, -STRIP.tall, right - round, -STRIP.tall);
  shape.lineTo(-STRIP.margin + round, -STRIP.tall);
  shape.quadraticCurveTo(
    -STRIP.margin,
    -STRIP.tall,
    -STRIP.margin,
    -STRIP.tall + round
  );
  shape.lineTo(-STRIP.margin, -round);
  shape.quadraticCurveTo(-STRIP.margin, 0, -STRIP.margin + round, 0);
  const hole = new Path();
  hole.absarc(right - 4, -STRIP.tall + 6, 2, 0, Math.PI * 2, true);
  shape.holes = [hole];
  return shape;
}

/** How the strip is cut from its outline: to its thickness, with a fine chamfer. */
const STRIP_CUT = {
  bevelEnabled: true,
  bevelOffset: -0.12,
  bevelSegments: 2,
  bevelSize: 0.12,
  bevelThickness: 0.12,
  curveSegments: 12,
  depth: STRIP.thick - 0.24,
};

/**
 * A steel rule lying on the bench, face up, from 0 to `length` centimetres:
 * a ground stainless strip with a hanging hole, engraved and inked along its
 * far edge with a mark every millimetre, longer at every fifth and tenth,
 * and a numeral at every centimetre. The marks are exact, so a length laid
 * against the edge can be read off them.
 *
 * It is drawn in scene units with its zero mark at the origin, its scale
 * along x, and its graduated edge away from the reader, toward -z.
 *
 * @param length - How far the scale runs, in centimetres
 */
export function Rule({ length }: { readonly length: number }) {
  const shape = useMemo(() => stripShape(length * 10), [length]);
  const marks = useMemo(
    () =>
      straightMarks({
        count: length * 10 + 1,
        direction: -1,
        edge: 0,
        every: [10, 5],
        face: STRIP.thick,
        lengths: [7, 5, 3.2],
        start: 0,
        step: 1,
        width: 0.16,
      }),
    [length]
  );

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} scale={MILLIMETRE}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[shape, STRIP_CUT]} />
        <SurfaceMaterial
          bump={0.35}
          color={INSTRUMENT_COLORS.toolSteel}
          metalness={1}
          repeat={GRAIN}
          roughness={0.36}
          surface="brushed"
        />
      </mesh>
      <Marks placements={marks} />
      {Arr.makeBy(length + 1, (centimetre) => (
        <Numeral
          at={[centimetre * 10, -10.6, STRIP.thick + 0.02]}
          height={4.2}
          key={centimetre}
          text={`${centimetre}`}
        />
      ))}
      <Numeral at={[4, -20.5, STRIP.thick + 0.02]} height={3} text="cm" />
    </group>
  );
}
