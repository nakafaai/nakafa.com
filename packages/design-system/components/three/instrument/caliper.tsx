import { RoundedBox } from "@react-three/drei";
import { useGlide } from "@repo/design-system/components/three/instrument/glide";
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
import type { ReactNode } from "react";
import { useRef } from "react";
import type { Group } from "three";
import { Path, Shape } from "three";

/** How far the main scale runs, in millimetres. */
const RANGE = 150;

/** The beam: how tall and thick it is, and where it ends past the fixed jaw's face. */
const BEAM = { end: 200, tall: 16, thick: 3.2 } as const;

/** How far the vernier zero stands from the sliding jaw's face, and so the main zero from the fixed one. */
const ZERO = 6;

/** The line the main scale and the vernier meet on, up the beam. */
const EDGE = 3.4;

/** How long the jaws reach below the beam. */
const JAW = 40;

/** The slide: its length, and how far it reaches below and above the beam's lower edge. */
const SLIDE = { below: -8, long: 58, top: 20 } as const;

/** How thick the vernier plate over the beam is: thin, so the two scales meet without parallax. */
const PLATE = 0.3;

/** How quickly the slide glides to a new reading, per second. */
const GLIDE = 7;

/** One tile of brushed steel for every 36 millimetres of an extruded face. */
const GRAIN = [1 / 36, 1 / 36] as const;

/** An outline through the given corners. */
function outline(corners: readonly (readonly [number, number])[]) {
  const shape = new Shape();
  Arr.forEach(corners, ([x, y], index) => {
    if (index === 0) {
      shape.moveTo(x, y);
      return;
    }
    shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

/** A solid `thick` deep cut from an outline, its edges chamfered by `chamfer` without growing. */
function cut(thick: number, chamfer: number) {
  return {
    bevelEnabled: true,
    bevelOffset: -chamfer,
    bevelSegments: 2,
    bevelSize: chamfer,
    bevelThickness: chamfer,
    curveSegments: 8,
    depth: thick - 2 * chamfer,
  };
}

/** The beam with its fixed outside jaw below and its fixed inside nib above, in one piece. */
const BEAM_SHAPE = outline([
  [BEAM.end, 0],
  [BEAM.end, BEAM.tall],
  [0, BEAM.tall],
  [0, 31],
  [-2.4, 31],
  [-9, 19],
  [-9, BEAM.tall],
  [-17, BEAM.tall],
  [-17, -7],
  [-3.6, -JAW],
  [0, -JAW],
  [0, 0],
]);

/** The sliding outside jaw, hanging from the slide. */
const JAW_SHAPE = outline([
  [0, SLIDE.below],
  [0, -JAW],
  [3.6, -JAW],
  [16, SLIDE.below],
]);

/** The sliding inside nib, standing on the slide. */
const NIB_SHAPE = outline([
  [0, SLIDE.top],
  [0, 31],
  [2.4, 31],
  [9, SLIDE.top],
]);

/** The vernier plate: the slide's face, with the window the main scale shows through. */
const PLATE_SHAPE = (() => {
  const shape = outline([
    [0, SLIDE.below],
    [SLIDE.long, SLIDE.below],
    [SLIDE.long, SLIDE.top],
    [0, SLIDE.top],
  ]);
  const window = new Path();
  window.moveTo(3.5, EDGE);
  window.lineTo(3.5, 13.2);
  window.lineTo(SLIDE.long - 4, 13.2);
  window.lineTo(SLIDE.long - 4, EDGE);
  window.closePath();
  shape.holes.push(window);
  return shape;
})();

const BEAM_CUT = cut(BEAM.thick, 0.22);
const JAW_CUT = cut(BEAM.thick, 0.22);
const PLATE_CUT = cut(PLATE, 0.05);

/** The main scale: a mark every millimetre, longer at every fifth and tenth. */
const MAIN_MARKS = straightMarks({
  count: RANGE + 1,
  direction: 1,
  edge: EDGE,
  every: [10, 5],
  face: BEAM.thick,
  lengths: [4.4, 3.4, 2.4],
  start: ZERO,
  step: 1,
  width: 0.13,
});

/** The centimetre numerals of the main scale. */
const CENTIMETRES = Arr.makeBy(RANGE / 10 + 1, (index) => index);

/** The satin chrome of the slide. */
function Chrome() {
  return (
    <SurfaceMaterial
      color={INSTRUMENT_COLORS.satinChrome}
      metalness={1}
      repeat={GRAIN}
      roughness={0.4}
      surface="brushed"
    />
  );
}

/** The ground tool steel of the beam and the jaws. */
function Steel() {
  return (
    <SurfaceMaterial
      color={INSTRUMENT_COLORS.toolSteel}
      metalness={1}
      repeat={GRAIN}
      roughness={0.3}
      surface="brushed"
    />
  );
}

/**
 * A vernier caliper lying on the bench, face up, set to `reading`
 * millimetres: a ground steel beam with its fixed jaws, engraved and inked
 * in millimetres with a numeral at every centimetre, and a satin slide that
 * carries the vernier, the thumb roll and the lock screw. The vernier has
 * `divisions` divisions over one millimetre less than as many main ones, so
 * the one vernier line that meets a main mark counts the fraction. The
 * scales are exact: the reading can be read off them.
 *
 * It is drawn in scene units with its scale along x. With `hold` at "beam"
 * the origin is the fixed jaw's face and the slide moves; at "slide" the
 * origin is the sliding jaw's face and the beam moves under it, as when the
 * camera follows the reading. Its children are what the jaws hold, placed in
 * millimetres from the fixed jaw's face at the beam's lower edge: x toward
 * the slide, y up the beam's face, z up from the back of the beam.
 *
 * @param reading - The opening between the jaws, in millimetres
 * @param divisions - How many divisions the vernier has
 * @param hold - Which part stays in place
 */
export function Caliper({
  children,
  divisions = 10,
  hold = "beam",
  reading,
}: {
  readonly children?: ReactNode;
  readonly divisions?: number;
  readonly hold?: "beam" | "slide";
  readonly reading: number;
}) {
  const beam = useRef<Group>(null);
  const slide = useRef<Group>(null);
  const step = (divisions - 1) / divisions;
  const vernier = straightMarks({
    count: divisions + 1,
    direction: -1,
    edge: EDGE,
    every: [divisions, 5],
    face: BEAM.thick + PLATE,
    lengths: [3, 3, 2],
    start: ZERO,
    step,
    width: 0.13,
  });

  useGlide(reading, GLIDE, (opening) => {
    beam.current?.position.setX(hold === "slide" ? -opening : 0);
    slide.current?.position.setX(hold === "slide" ? 0 : opening);
  });

  return (
    <group
      position={[0, MILLIMETRE, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={MILLIMETRE}
    >
      <group ref={beam}>
        <mesh castShadow receiveShadow>
          <extrudeGeometry args={[BEAM_SHAPE, BEAM_CUT]} />
          <Steel />
        </mesh>
        <Marks placements={MAIN_MARKS} />
        {Arr.map(CENTIMETRES, (centimetre) => (
          <Numeral
            at={[ZERO + centimetre * 10, EDGE + 6.3, BEAM.thick + 0.02]}
            height={2.5}
            key={centimetre}
            text={`${centimetre}`}
          />
        ))}
        <Numeral
          at={[RANGE + ZERO + 14, EDGE + 6.3, BEAM.thick + 0.02]}
          height={2.1}
          text="mm"
        />
        {children}
      </group>
      <group ref={slide}>
        <mesh castShadow position={[0, 0, BEAM.thick]}>
          <extrudeGeometry args={[PLATE_SHAPE, PLATE_CUT]} />
          <Chrome />
        </mesh>
        <mesh castShadow receiveShadow>
          <extrudeGeometry args={[JAW_SHAPE, JAW_CUT]} />
          <Steel />
        </mesh>
        <mesh castShadow receiveShadow>
          <extrudeGeometry args={[NIB_SHAPE, JAW_CUT]} />
          <Steel />
        </mesh>
        <RoundedBox
          args={[SLIDE.long, 7.4, BEAM.thick + 1]}
          castShadow
          position={[SLIDE.long / 2, SLIDE.below + 3.7, BEAM.thick / 2 - 0.5]}
          radius={0.3}
          smoothness={2}
        >
          <Chrome />
        </RoundedBox>
        <RoundedBox
          args={[SLIDE.long, SLIDE.top - BEAM.tall - 0.3, BEAM.thick + 1]}
          castShadow
          position={[
            SLIDE.long / 2,
            (SLIDE.top + BEAM.tall + 0.3) / 2,
            BEAM.thick / 2 - 0.5,
          ]}
          radius={0.3}
          smoothness={2}
        >
          <Chrome />
        </RoundedBox>
        <RoundedBox
          args={[SLIDE.long, SLIDE.top - SLIDE.below, 1]}
          castShadow
          position={[SLIDE.long / 2, (SLIDE.top + SLIDE.below) / 2, -0.5]}
          radius={0.2}
          smoothness={2}
        >
          <Chrome />
        </RoundedBox>
        <RoundedBox
          args={[SLIDE.long, 5.6, 1.3]}
          castShadow
          position={[SLIDE.long / 2, SLIDE.below + 2.8, BEAM.thick + 0.65]}
          radius={0.35}
          smoothness={3}
        >
          <Chrome />
        </RoundedBox>
        <RoundedBox
          args={[SLIDE.long, 5.6, 1.3]}
          castShadow
          position={[SLIDE.long / 2, SLIDE.top - 2.8, BEAM.thick + 0.65]}
          radius={0.35}
          smoothness={3}
        >
          <Chrome />
        </RoundedBox>
        <Marks placements={vernier} />
        <Numeral
          at={[ZERO, EDGE - 4.2, BEAM.thick + PLATE + 0.02]}
          height={1.5}
          text="0"
        />
        <Numeral
          at={[
            ZERO + (divisions / 2) * step,
            EDGE - 4.2,
            BEAM.thick + PLATE + 0.02,
          ]}
          height={1.5}
          text={`${divisions / 2}`}
        />
        <Numeral
          at={[ZERO + divisions * step, EDGE - 4.2, BEAM.thick + PLATE + 0.02]}
          height={1.5}
          text={`${divisions}`}
        />
        <mesh
          castShadow
          position={[SLIDE.long - 13, SLIDE.below - 3.4, BEAM.thick / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[4.4, 4.4, 3, 48]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.satinChrome}
            metalness={1}
            repeat={[10, 1]}
            roughness={0.36}
            surface="knurl"
          />
        </mesh>
        <mesh castShadow position={[24, SLIDE.top + 1.2, BEAM.thick / 2]}>
          <cylinderGeometry args={[1.5, 1.5, 2.4, 20]} />
          <Steel />
        </mesh>
        <mesh castShadow position={[24, SLIDE.top + 3.8, BEAM.thick / 2]}>
          <cylinderGeometry args={[3, 3, 3, 40]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.satinChrome}
            metalness={1}
            repeat={[8, 1]}
            roughness={0.36}
            surface="knurl"
          />
        </mesh>
        <mesh castShadow position={[(SLIDE.long + BEAM.end) / 2, 7.6, -0.5]}>
          <boxGeometry args={[BEAM.end - SLIDE.long, 2.6, 0.9]} />
          <Steel />
        </mesh>
      </group>
    </group>
  );
}
