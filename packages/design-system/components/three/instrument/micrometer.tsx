import { RoundedBox } from "@react-three/drei";
import { useGlide } from "@repo/design-system/components/three/instrument/glide";
import {
  Marks,
  Numeral,
} from "@repo/design-system/components/three/instrument/ink";
import {
  barrelMarks,
  MILLIMETRE,
  rimAngle,
  rimMarks,
} from "@repo/design-system/components/three/instrument/scale";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { getColor } from "@repo/design-system/lib/color";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { Group } from "three";
import { Shape } from "three";

/** How far the gauge measures, in millimetres. */
const RANGE = 25;

/** How many divisions the thimble's rim carries. */
const DIVISIONS = 50;

/** The radius of the spindle and the anvil. */
const SPINDLE = 3.25;

/** The sleeve: its radius, where it leaves the frame, and where its zero line stands. */
const SLEEVE = { from: 40, radius: 6, zero: 42 } as const;

/** The thimble: its radius, the length of its bevel, and its whole length. */
const THIMBLE = { bevel: 4.6, long: 38, radius: 8.6 } as const;

/** The radius of the thimble's bevel at its reading edge: a hair over the sleeve. */
const EDGE = SLEEVE.radius + 0.22;

/** How steeply the bevel widens, in radians. */
const SLOPE = Math.atan((THIMBLE.radius - EDGE) / THIMBLE.bevel);

/** How thick the frame is. */
const FRAME = 6.4;

/** How far the frame's low corner drops as the gauge rests on its thimble, as an angle. */
const REST = Math.asin((THIMBLE.radius - FRAME / 2) / 74);

/** How quickly the spindle closes on a new size, per second. */
const GLIDE = 6;

/** The C frame: its outer back, its two arms, and the round throat between them. */
const FRAME_SHAPE = (() => {
  const shape = new Shape();
  shape.moveTo(-13, 8);
  shape.lineTo(-13, -22);
  shape.quadraticCurveTo(-13, -36, 1, -36);
  shape.lineTo(26, -36);
  shape.quadraticCurveTo(40, -36, 40, -22);
  shape.lineTo(40, 8);
  shape.lineTo(29, 8);
  shape.lineTo(29, -15);
  shape.quadraticCurveTo(29, -24, 20, -24);
  shape.lineTo(5, -24);
  shape.quadraticCurveTo(-4, -24, -4, -15);
  shape.lineTo(-4, 8);
  shape.closePath();
  return shape;
})();

const FRAME_CUT = {
  bevelEnabled: true,
  bevelOffset: -0.9,
  bevelSegments: 4,
  bevelSize: 0.9,
  bevelThickness: 0.9,
  curveSegments: 20,
  depth: FRAME - 1.8,
};

/** The datum line along the sleeve. */
const DATUM = [
  {
    position: [SLEEVE.zero + RANGE / 2, 0, SLEEVE.radius + 0.015],
    scale: [RANGE + 1.2, 0.13, 0.03],
  },
] as const;

/** The whole millimetres above the datum line and the half millimetres below it. */
const WHOLE_MARKS = barrelMarks({
  count: RANGE + 1,
  every: [5, 5],
  lengths: [2.7, 2.7, 1.9],
  radius: SLEEVE.radius,
  side: 1,
  start: SLEEVE.zero,
  step: 1,
  width: 0.13,
});
const HALF_MARKS = barrelMarks({
  count: RANGE,
  every: [5, 5],
  lengths: [1.5, 1.5, 1.5],
  radius: SLEEVE.radius,
  side: -1,
  start: SLEEVE.zero + 0.5,
  step: 1,
  width: 0.13,
});

/** The fifty hundredths around the thimble's bevel. */
const RIM_MARKS = rimMarks({
  count: DIVISIONS,
  every: [5, 5],
  lengths: [3.6, 3.6, 2.2],
  radius: EDGE,
  slope: SLOPE,
  width: 0.13,
});

/** The numerals of the sleeve, every five millimetres, and of the rim, every five divisions. */
const SLEEVE_NUMERALS = Arr.makeBy(RANGE / 5 + 1, (index) => index * 5);
const RIM_NUMERALS = Arr.makeBy(DIVISIONS / 5, (index) => index * 5);

/** How far around the sleeve its numerals stand from the datum line. */
const NUMERAL_ANGLE = Math.PI / 2 - 3.9 / SLEEVE.radius;

/** Satin chrome, brushed around the axis of a turned part. */
function Chrome({ knurled = false }: { readonly knurled?: boolean }) {
  return (
    <SurfaceMaterial
      color={INSTRUMENT_COLORS.satinChrome}
      metalness={1}
      repeat={knurled ? [14, 4] : [3, 1]}
      roughness={knurled ? 0.36 : 0.34}
      surface={knurled ? "knurl" : "brushed"}
    />
  );
}

/** A turned part: a cylinder along the gauge's axis from `from` to `to`. */
function Turned({
  children,
  from,
  radius,
  to,
  wide = radius,
}: {
  readonly children: ReactNode;
  readonly from: number;
  readonly radius: number;
  readonly to: number;
  readonly wide?: number;
}) {
  return (
    <mesh
      castShadow
      position={[(from + to) / 2, 0, 0]}
      receiveShadow
      rotation={[0, 0, -Math.PI / 2]}
    >
      <cylinderGeometry args={[wide, radius, to - from, 64]} />
      {children}
    </mesh>
  );
}

/**
 * A micrometer screw gauge lying on the bench, closed to `reading`
 * millimetres: an enamelled C frame with its heat guard, a carbide-faced
 * anvil and spindle, a satin sleeve engraved in whole millimetres above its
 * datum line and half millimetres below it, and a thimble whose bevelled rim
 * carries fifty divisions, with its knurled grip and ratchet. One turn of
 * the thimble moves the spindle half a millimetre, so the thimble's edge
 * uncovers the sleeve and its rim turns to the hundredths exactly: the
 * reading can be read off it.
 *
 * It is drawn in scene units with its axis along x and the anvil's face near
 * the origin. Its children are what it holds, placed in millimetres from the
 * anvil's face along the axis.
 *
 * @param reading - The gap between the anvil and the spindle, in millimetres
 * @param pitch - How far one turn of the thimble moves the spindle
 */
export function Micrometer({
  children,
  pitch = 0.5,
  reading,
}: {
  readonly children?: ReactNode;
  readonly pitch?: number;
  readonly reading: number;
}) {
  const thimble = useRef<Group>(null);

  useGlide(reading, GLIDE, (travel) => {
    thimble.current?.position.setX(SLEEVE.zero + travel);
    thimble.current?.rotation.set((travel / pitch) * 2 * Math.PI, 0, 0);
  });

  return (
    <group
      position={[60 * MILLIMETRE, THIMBLE.radius * MILLIMETRE, 0]}
      rotation={[0, 0, REST]}
    >
      <group
        position={[-60 * MILLIMETRE, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={MILLIMETRE}
      >
        <mesh castShadow position={[0, 0, -FRAME / 2 + 0.9]} receiveShadow>
          <extrudeGeometry args={[FRAME_SHAPE, FRAME_CUT]} />
          <SurfaceMaterial
            coat={0.35}
            color={INSTRUMENT_COLORS.enamel}
            repeat={[1 / 26, 1 / 26]}
            roughness={0.46}
            surface="paint"
          />
        </mesh>
        <RoundedBox
          args={[25, 8.4, FRAME + 0.7]}
          castShadow
          position={[13, -30, 0]}
          radius={0.7}
          smoothness={3}
        >
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.gripPad}
            repeat={[3, 1]}
            roughness={0.7}
            surface="plastic"
          />
        </RoundedBox>
        <Numeral
          at={[13, -30, FRAME / 2 + 0.37]}
          height={2.6}
          ink={getColor("ZINC", 300)}
          text="0-25 mm"
        />
        <Turned from={-4.4} radius={SPINDLE} to={-0.9}>
          <Chrome />
        </Turned>
        <Turned from={-0.9} radius={SPINDLE} to={0}>
          <meshPhysicalMaterial
            color={INSTRUMENT_COLORS.carbide}
            metalness={1}
            roughness={0.2}
          />
        </Turned>
        <Turned from={SLEEVE.from} radius={SLEEVE.radius} to={SLEEVE.from + 34}>
          <Chrome />
        </Turned>
        <Marks placements={DATUM} />
        <Marks placements={WHOLE_MARKS} />
        <Marks placements={HALF_MARKS} />
        {Arr.map(SLEEVE_NUMERALS, (millimetre) => (
          <Numeral
            at={[
              SLEEVE.zero + millimetre,
              (SLEEVE.radius + 0.03) * Math.cos(NUMERAL_ANGLE),
              (SLEEVE.radius + 0.03) * Math.sin(NUMERAL_ANGLE),
            ]}
            height={1.7}
            key={millimetre}
            text={`${millimetre}`}
            turn={[NUMERAL_ANGLE - Math.PI / 2, 0, 0]}
          />
        ))}
        {children}
        <group ref={thimble}>
          <Turned from={-SLEEVE.zero + 0.9} radius={SPINDLE} to={0}>
            <Chrome />
          </Turned>
          <Turned from={-SLEEVE.zero} radius={SPINDLE} to={-SLEEVE.zero + 0.9}>
            <meshPhysicalMaterial
              color={INSTRUMENT_COLORS.carbide}
              metalness={1}
              roughness={0.2}
            />
          </Turned>
          <Turned
            from={0}
            radius={EDGE}
            to={THIMBLE.bevel}
            wide={THIMBLE.radius}
          >
            <Chrome />
          </Turned>
          <Turned from={THIMBLE.bevel} radius={THIMBLE.radius} to={14}>
            <Chrome />
          </Turned>
          <Turned from={14} radius={THIMBLE.radius + 0.25} to={THIMBLE.long}>
            <Chrome knurled />
          </Turned>
          <Turned from={THIMBLE.long} radius={4.2} to={THIMBLE.long + 3.5}>
            <Chrome />
          </Turned>
          <Turned from={THIMBLE.long + 3.5} radius={5.4} to={THIMBLE.long + 13}>
            <Chrome knurled />
          </Turned>
          <Marks placements={RIM_MARKS} />
          {Arr.map(RIM_NUMERALS, (division) => (
            <Numeral
              at={[
                THIMBLE.bevel + 2.4,
                (THIMBLE.radius + 0.03) * Math.cos(rimAngle(division, DIVISIONS)),
                (THIMBLE.radius + 0.03) * Math.sin(rimAngle(division, DIVISIONS)),
              ]}
              height={2.3}
              key={division}
              text={`${division}`}
              turn={[rimAngle(division, DIVISIONS) - Math.PI / 2, 0, 0]}
            />
          ))}
        </group>
      </group>
    </group>
  );
}
