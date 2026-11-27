import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Numeral } from "@repo/design-system/components/three/instrument/ink";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import {
  clockFigure,
  PLACES,
  SEGMENTS,
  segmentBars,
  segmentLit,
} from "@repo/design-system/components/three/instrument/segments";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { Repeat } from "@repo/design-system/components/three/repeat";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Mesh } from "three";
import {
  BoxGeometry,
  CatmullRomCurve3,
  MeshStandardMaterial,
  Shape,
  Vector2,
  Vector3,
} from "three";

/** The case: how wide, tall and thick it is, in millimetres. */
const CASE = { tall: 82, thick: 19, wide: 66 } as const;

/** The display: its width and height, and how high its middle stands on the case. */
const DISPLAY = { middle: 7, tall: 24, wide: 48 } as const;

/** The height of the display's glass over the back of the case. */
const FACE = CASE.thick / 2;

/** The large figures of minutes and seconds, and the small ones of the hundredths. */
const LARGE = { tall: 12.5, thick: 1.5, wide: 6.6 } as const;
const SMALL = { tall: 8.6, thick: 1.1, wide: 4.6 } as const;

/** Where each figure's middle stands on the display, with the size it is drawn at. */
const FIGURES = [
  { at: [-18.2, 0], size: LARGE },
  { at: [-8, 0], size: LARGE },
  { at: [0.4, 0], size: LARGE },
  { at: [9.6, -1.95], size: SMALL },
  { at: [15.6, -1.95], size: SMALL },
] as const;

/** The dots of the display: the colon after the minutes and the point before the hundredths. */
const DOTS = [
  { position: [-13.1, 2.6, 0], scale: [1.5, 1.5, 0.06] },
  { position: [-13.1, -2.6, 0], scale: [1.5, 1.5, 0.06] },
  { position: [5.2, -5.5, 0], scale: [1.4, 1.4, 0.06] },
] as const;

/** Every bar of every figure: where it lies on the display and its size. */
const BARS = Arr.flatMap(FIGURES, (figure) =>
  Arr.map(segmentBars(figure.size), (bar) => ({
    position: [figure.at[0] + bar.at[0], figure.at[1] + bar.at[1], 0] as const,
    scale: [bar.size[0], bar.size[1], 0.06] as const,
  }))
);

/** The outline of the case: a rounded body, a little wider at its shoulders. */
const CASE_SHAPE = (() => {
  const shape = new Shape();
  const half = CASE.wide / 2 - 3.5;
  const top = CASE.tall / 2 - 3.5;
  shape.moveTo(-half + 20, -top);
  shape.lineTo(half - 20, -top);
  shape.quadraticCurveTo(half, -top, half, -top + 22);
  shape.lineTo(half, top - 16);
  shape.quadraticCurveTo(half, top, half - 16, top);
  shape.lineTo(-half + 16, top);
  shape.quadraticCurveTo(-half, top, -half, top - 16);
  shape.lineTo(-half, -top + 22);
  shape.quadraticCurveTo(-half, -top, -half + 20, -top);
  return shape;
})();

const CASE_CUT = {
  bevelEnabled: true,
  bevelSegments: 8,
  bevelSize: 3.5,
  bevelThickness: 3.5,
  curveSegments: 24,
  depth: CASE.thick - 7,
};

/** The profile of a pusher: a moulded button with a domed top, from its axis outward. */
const PUSHER_PROFILE = [
  new Vector2(0, 9.2),
  new Vector2(2.4, 9),
  new Vector2(4.2, 8.1),
  new Vector2(5, 6.6),
  new Vector2(5, 1.2),
  new Vector2(5.8, 0.6),
  new Vector2(5.8, 0),
  new Vector2(0, 0),
];

/** Where the three pushers stand along the top of the case, and how each leans. */
const PUSHERS = [
  { at: [-21, CASE.tall / 2 - 6.5], color: "pusher", lean: 0.5 },
  { at: [0, CASE.tall / 2 - 0.6], color: "pusherStop", lean: 0 },
  { at: [21, CASE.tall / 2 - 6.5], color: "pusher", lean: -0.5 },
] as const;

/** The path of the neck cord: from its lug over the top of the case and down onto the bench behind it. */
const CORD = new CatmullRomCurve3([
  new Vector3(0, CASE.tall / 2 + 9, 0),
  new Vector3(-6, CASE.tall / 2 + 22, -6),
  new Vector3(-22, CASE.tall / 2 + 20, -26),
  new Vector3(-48, CASE.tall / 2 - 6, -52),
  new Vector3(-70, CASE.tall / 2 - 40, -70),
]);

/** The moulded plastic of the case. */
function Moulded({ color }: { readonly color: string }) {
  return (
    <SurfaceMaterial
      bump={0.5}
      color={color}
      repeat={[3, 3]}
      roughness={0.5}
      surface="plastic"
    />
  );
}

/**
 * A digital stopwatch that reads to a hundredth of a second: a moulded case
 * with its start, stop and reset pushers, a neck cord, and a liquid-crystal
 * display under glass whose seven-segment figures show the time `seconds`
 * gives, as minutes, seconds and hundredths. The figures are set on each
 * frame without drawing the scene again, so the watch runs smoothly.
 *
 * It is drawn in scene units, upright, its display toward +z and its middle
 * at the origin.
 *
 * @param seconds - Reads the time the watch shows, in seconds
 */
export function Stopwatch({ seconds }: { readonly seconds: () => number }) {
  const lit = useRef<(Mesh | null)[]>([]);
  const bar = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const crystal = useMemo(
    () =>
      new MeshStandardMaterial({
        color: INSTRUMENT_COLORS.lcdInk,
        roughness: 0.6,
      }),
    []
  );

  useEffect(
    () => () => {
      bar.dispose();
      crystal.dispose();
    },
    [bar, crystal]
  );

  useFrame(() => {
    const time = seconds();
    for (let place = 0; place < PLACES; place += 1) {
      const figure = clockFigure(time, place);
      for (let segment = 0; segment < SEGMENTS; segment += 1) {
        const mesh = lit.current[place * SEGMENTS + segment];
        if (mesh) {
          mesh.visible = segmentLit(figure, segment);
        }
      }
    }
  });

  return (
    <group scale={MILLIMETRE}>
      <mesh castShadow position={[0, 0, -FACE + 3.5]} receiveShadow>
        <extrudeGeometry args={[CASE_SHAPE, CASE_CUT]} />
        <Moulded color={INSTRUMENT_COLORS.caseShell} />
      </mesh>
      <RoundedBox
        args={[DISPLAY.wide + 7, DISPLAY.tall + 7, 1.6]}
        position={[0, DISPLAY.middle, FACE]}
        radius={0.7}
        smoothness={3}
      >
        <Moulded color={INSTRUMENT_COLORS.gripPad} />
      </RoundedBox>
      <group position={[0, DISPLAY.middle, FACE + 0.85]}>
        <mesh>
          <planeGeometry args={[DISPLAY.wide, DISPLAY.tall]} />
          <meshStandardMaterial color={INSTRUMENT_COLORS.lcd} roughness={0.5} />
        </mesh>
        <group position={[0, 0.6, 0.05]}>
          <Repeat placements={BARS} shadows={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={INSTRUMENT_COLORS.lcdInk}
              opacity={0.07}
              transparent
            />
          </Repeat>
          <Repeat placements={DOTS} shadows={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={INSTRUMENT_COLORS.lcdInk}
              roughness={0.6}
            />
          </Repeat>
          {Arr.map(BARS, (placed, index) => (
            <mesh
              geometry={bar}
              key={`${placed.position[0]} ${placed.position[1]}`}
              material={crystal}
              position={[placed.position[0], placed.position[1], 0.02]}
              ref={(mesh) => {
                lit.current[index] = mesh;
              }}
              scale={[placed.scale[0], placed.scale[1], placed.scale[2]]}
            />
          ))}
        </group>
        <mesh position={[0, 0, 0.5]}>
          <planeGeometry args={[DISPLAY.wide + 1.5, DISPLAY.tall + 1.5]} />
          <GlassMaterial color={INSTRUMENT_COLORS.crystal} opacity={0.12} />
        </mesh>
      </group>
      <Numeral
        at={[0, -13.5, FACE + 0.04]}
        height={3.4}
        ink={INSTRUMENT_COLORS.caseLegend}
        text="1/100 s"
      />
      <Numeral
        at={[-17.5, 26.5, FACE + 0.04]}
        height={2.3}
        ink={INSTRUMENT_COLORS.caseLegend}
        text="RESET"
      />
      <Numeral
        at={[16, 26.5, FACE + 0.04]}
        height={2.3}
        ink={INSTRUMENT_COLORS.caseLegend}
        text="START/STOP"
      />
      {Arr.map(PUSHERS, (pusher) => (
        <mesh
          castShadow
          key={pusher.at[0]}
          position={[pusher.at[0], pusher.at[1], 0]}
          rotation={[0, 0, pusher.lean]}
        >
          <latheGeometry args={[PUSHER_PROFILE, 40]} />
          <Moulded color={INSTRUMENT_COLORS[pusher.color]} />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[0, CASE.tall / 2 + 9, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <torusGeometry args={[3.4, 0.7, 12, 40]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.satinChrome}
          metalness={1}
          repeat={[4, 1]}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow>
        <tubeGeometry args={[CORD, 64, 1.1, 10, false]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.gripPad}
          repeat={[1, 40]}
          roughness={0.9}
          surface="cloth"
        />
      </mesh>
    </group>
  );
}
