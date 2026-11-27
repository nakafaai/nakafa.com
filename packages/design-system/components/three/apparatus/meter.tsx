import { RoundedBox } from "@react-three/drei";
import {
  cardOf,
  displayOf,
  needleOf,
  PIVOT,
  WINDOW,
} from "@repo/design-system/components/three/apparatus/face";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { PrintFace } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

/** How far a bench meter's case leans back from upright, in radians. */
const LEAN = 0.3;

/** The case's width, height and depth, and how far its window's middle is above its foot, in metres. */
const CASE = { deep: 0.05, height: 0.108, sight: 0.064, width: 0.122 } as const;

/** How thick the bezel's bars are, and how far they stand out of the case. */
const BEZEL = { bar: 0.007, proud: 0.007 } as const;

/**
 * Where the leads of a meter meet it, the negative post first, from the
 * middle of the meter's foot on the bench: the top of each binding post.
 */
export const METER_POSTS = [
  [-0.038, 0.047, 0.036],
  [0.038, 0.047, 0.036],
] as const;

/** The four rubber feet of a meter's plinth. */
const FEET = [
  [-0.05, -0.036],
  [0.05, -0.036],
  [-0.05, 0.04],
  [0.05, 0.04],
] as const;

/** The four bars of the bezel about the window: where each is, and its size. */
const BARS = [
  {
    at: [0, WINDOW.height / 2 + BEZEL.bar / 2],
    size: [WINDOW.width + BEZEL.bar * 2, BEZEL.bar],
  },
  {
    at: [0, -WINDOW.height / 2 - BEZEL.bar / 2],
    size: [WINDOW.width + BEZEL.bar * 2, BEZEL.bar],
  },
  {
    at: [-WINDOW.width / 2 - BEZEL.bar / 2, 0],
    size: [BEZEL.bar, WINDOW.height],
  },
  {
    at: [WINDOW.width / 2 + BEZEL.bar / 2, 0],
    size: [BEZEL.bar, WINDOW.height],
  },
] as const;

/** The colours a meter's face is printed in. */
const CARD_INKS = {
  accent: LABWARE_COLORS.dialRed,
  ground: LABWARE_COLORS.dial,
  ink: LABWARE_COLORS.dialInk,
};
const DISPLAY_INKS = {
  accent: LABWARE_COLORS.lcdInk,
  ground: LABWARE_COLORS.lcd,
  ink: LABWARE_COLORS.lcdInk,
};

/** A 4 mm binding post: an insulated collar in its colour, a brass stud, and a knurled nickel nut. */
function Post({
  color,
  position,
}: {
  readonly color: string;
  readonly position: readonly [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.0085, 0.0095, 0.008, 28]} />
        <SurfaceMaterial
          coat={0.4}
          color={color}
          repeat={[2, 1]}
          roughness={0.5}
          surface="plastic"
        />
      </mesh>
      <mesh castShadow position={[0, -0.011, 0]}>
        <cylinderGeometry args={[0.0028, 0.0028, 0.022, 16]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.brass}
          metalness={1}
          repeat={[1, 2]}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow position={[0, -0.009, 0]}>
        <cylinderGeometry args={[0.0074, 0.0074, 0.0085, 32]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.nickel}
          metalness={1}
          repeat={[6, 1]}
          roughness={0.28}
          surface="knurl"
        />
      </mesh>
      <mesh position={[0, -0.0035, 0]}>
        <cylinderGeometry args={[0.0052, 0.0074, 0.0025, 32]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.nickel}
          metalness={1}
          roughness={0.24}
          surface="brushed"
        />
      </mesh>
    </group>
  );
}

/**
 * The case every bench meter shares: a moulded case leaning back on a
 * plinth with rubber feet, a window framed by a bevelled bezel under a pane
 * of glass, a zero screw under the window, and a black and a red binding
 * post in front. Its children are what the window shows, drawn on the plane
 * of the card with the card's middle at the origin.
 */
function Case({ children }: { readonly children: ReactNode }) {
  return (
    <group>
      {Arr.map(FEET, ([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.002, z]}>
          <cylinderGeometry args={[0.007, 0.008, 0.004, 20]} />
          <SurfaceMaterial
            color={LABWARE_COLORS.rubber}
            roughness={0.9}
            surface="rubber"
          />
        </mesh>
      ))}
      <RoundedBox
        args={[CASE.width + 0.008, 0.018, 0.104]}
        castShadow
        position={[0, 0.013, 0.002]}
        radius={0.004}
        receiveShadow
        smoothness={4}
      >
        <SurfaceMaterial
          bump={0.25}
          coat={0.35}
          color={LABWARE_COLORS.bakelite}
          repeat={[3, 3]}
          roughness={0.5}
          surface="plastic"
        />
      </RoundedBox>
      <Post color={LABWARE_COLORS.leadBlack} position={METER_POSTS[0]} />
      <Post color={LABWARE_COLORS.leadRed} position={METER_POSTS[1]} />
      <group position={[0, 0.02, -0.014]} rotation={[-LEAN, 0, 0]}>
        <RoundedBox
          args={[CASE.width, CASE.height, CASE.deep]}
          castShadow
          position={[0, CASE.height / 2, 0]}
          radius={0.006}
          receiveShadow
          smoothness={5}
        >
          <SurfaceMaterial
            bump={0.25}
            coat={0.45}
            color={LABWARE_COLORS.bakelite}
            repeat={[3, 3]}
            roughness={0.46}
            surface="plastic"
          />
        </RoundedBox>
        <group position={[0, CASE.sight, CASE.deep / 2]}>
          {Arr.map(BARS, (bar) => (
            <RoundedBox
              args={[bar.size[0], bar.size[1], BEZEL.proud]}
              castShadow
              key={`${bar.at[0]}:${bar.at[1]}`}
              position={[bar.at[0], bar.at[1], BEZEL.proud / 2 - 0.001]}
              radius={0.0016}
              smoothness={3}
            >
              <SurfaceMaterial
                coat={0.6}
                color={LABWARE_COLORS.bezel}
                roughness={0.36}
                surface="plastic"
              />
            </RoundedBox>
          ))}
          <group position={[0, 0, 0.0006]}>{children}</group>
          <mesh position={[0, 0, BEZEL.proud - 0.0022]}>
            <planeGeometry args={[WINDOW.width, WINDOW.height]} />
            <GlassMaterial color={LABWARE_COLORS.glass} opacity={0.1} />
          </mesh>
        </group>
        <group
          position={[0, CASE.sight - WINDOW.height / 2 - 0.02, CASE.deep / 2]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0042, 0.0042, 0.003, 24]} />
            <SurfaceMaterial
              color={LABWARE_COLORS.nickel}
              metalness={1}
              roughness={0.3}
              surface="brushed"
            />
          </mesh>
          <mesh position={[0, 0, 0.0016]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.0066, 0.0009, 0.0006]} />
            <meshStandardMaterial
              color={LABWARE_COLORS.bezel}
              roughness={0.8}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/**
 * A moving-coil bench meter standing on the bench at y = 0, facing +z: a
 * bakelite case with a bezelled window, a printed card with its scale, a
 * blade needle on its pivot under a cover plate, and two binding posts
 * (`METER_POSTS`). The needle stands at the reading on the card's own
 * scale, and rests at the scale's low end while the meter reads nothing.
 *
 * @example
 * <Meter reading={1.1} scale={{ from: 0, major: 1, minor: 0.25, to: 3 }} unit="V" />
 *
 * @param reading - What the meter reads, in its unit
 * @param scale - The values its scale runs between, and its steps
 * @param unit - The unit printed on the card
 */
export function Meter({
  reading,
  scale,
  unit,
}: {
  readonly reading?: number;
  readonly scale: {
    readonly from: number;
    readonly major: number;
    readonly minor?: number;
    readonly to: number;
  };
  readonly unit: string;
}) {
  const format = usePrintNumber();
  const { from, major, minor, to } = scale;
  const movement = useMemo(
    () => ({
      scale:
        minor === undefined ? { from, major, to } : { from, major, minor, to },
      unit,
    }),
    [from, major, minor, to, unit]
  );
  const card = useMemo(
    () => cardOf(movement, CARD_INKS, format),
    [format, movement]
  );

  return (
    <Case>
      <PrintFace sheet={card} stock="ink" />
      <group
        position={[PIVOT[0], PIVOT[1], 0.0022]}
        rotation={[0, 0, needleOf(movement, reading)]}
      >
        <mesh position={[0, 0.0195, 0]}>
          <boxGeometry args={[0.0008, 0.039, 0.0004]} />
          <meshStandardMaterial color={LABWARE_COLORS.needle} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.0035, 0]}>
          <boxGeometry args={[0.0022, 0.005, 0.0006]} />
          <meshStandardMaterial color={LABWARE_COLORS.needle} roughness={0.5} />
        </mesh>
      </group>
      <RoundedBox
        args={[WINDOW.width, 0.0125, 0.0034]}
        position={[0, -WINDOW.height / 2 + 0.006_25, 0.0026]}
        radius={0.001}
        smoothness={3}
      >
        <SurfaceMaterial
          coat={0.3}
          color={LABWARE_COLORS.bezel}
          roughness={0.5}
          surface="plastic"
        />
      </RoundedBox>
    </Case>
  );
}

/**
 * A digital bench meter standing on the bench at y = 0, facing +z: the case
 * of a bench meter with a backlit liquid-crystal display in its window and
 * two binding posts (`METER_POSTS`). The display shows the reading to the
 * decimals asked for with its unit, and is blank while the meter reads
 * nothing.
 *
 * @example
 * <Readout digits={2} reading={1.1} unit="V" />
 *
 * @param digits - How many decimals the display shows
 * @param reading - What the meter reads, in its unit
 * @param unit - The unit shown after the figures
 */
export function Readout({
  digits,
  reading,
  unit,
}: {
  readonly digits: number;
  readonly reading?: number;
  readonly unit: string;
}) {
  const format = usePrintNumber();
  const display = useMemo(
    () =>
      displayOf(
        reading === undefined ? undefined : format(reading, digits),
        unit,
        DISPLAY_INKS
      ),
    [digits, format, reading, unit]
  );

  return (
    <Case>
      <PrintFace sheet={display} stock="display" />
    </Case>
  );
}
