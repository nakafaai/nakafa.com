import { RoundedBox } from "@react-three/drei";
import { useGlide } from "@repo/design-system/components/three/instrument/glide";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import {
  dialAngle,
  dialMarks,
} from "@repo/design-system/components/three/print/dial";
import { PrintDisc } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { words } from "@repo/design-system/components/three/print/sheet";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { Vector2 } from "three";

/** The body: how wide, tall and deep the cast housing is, in millimetres. */
const BODY = { deep: 120, tall: 104, wide: 168 } as const;

/** The dial: the radius of its face, and how high its middle stands on the front. */
const DIAL = { middle: 54, radius: 40 } as const;

/** The pan: its radius, and how high its floor stands over the body. */
const PAN = { lift: 16, radius: 78 } as const;

/** Where the needle stands at zero and at full scale, counter-clockwise from the x axis. */
const SWEEP = { from: (Math.PI * 4) / 3, to: -Math.PI / 3 } as const;

/** How quickly the needle settles on a new load, per second. */
const SETTLE = 4;

/** The pan's profile from its axis outward: a pressed stainless dish with a rolled rim. */
const PAN_PROFILE = [
  new Vector2(0, 0),
  new Vector2(PAN.radius - 12, 0),
  new Vector2(PAN.radius - 5, 1.6),
  new Vector2(PAN.radius - 1.5, 5),
  new Vector2(PAN.radius, 8.4),
  new Vector2(PAN.radius + 1.6, 9.4),
  new Vector2(PAN.radius + 2.4, 8.4),
  new Vector2(PAN.radius + 1.2, 6.6),
  new Vector2(PAN.radius - 3, 3.4),
  new Vector2(PAN.radius - 12, -1.2),
  new Vector2(0, -1.2),
];

/** The bezel's profile: a turned chrome ring that holds the crystal. */
const BEZEL_PROFILE = [
  new Vector2(DIAL.radius - 0.6, 0),
  new Vector2(DIAL.radius + 5, 0),
  new Vector2(DIAL.radius + 5.6, 1.4),
  new Vector2(DIAL.radius + 4.4, 4.6),
  new Vector2(DIAL.radius + 1.8, 6),
  new Vector2(DIAL.radius - 0.6, 5.2),
];

/** Where the four rubber feet stand under the body, as signs across and along it. */
const FEET = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;

/** Satin stainless steel. */
function Stainless() {
  return (
    <SurfaceMaterial
      color={INSTRUMENT_COLORS.satinChrome}
      metalness={1}
      repeat={[6, 2]}
      roughness={0.42}
      surface="brushed"
    />
  );
}

/**
 * A top-pan dial balance on the bench, showing `grams`: an enamelled cast
 * housing on rubber feet, a pressed stainless pan on its post, and a dial
 * under a crystal whose printed scale runs from 0 to `full` grams, numbered
 * every `major` and ticked every `minor`. The needle turns to the angle the
 * printed scale gives the load, so the mass can be read off the dial.
 *
 * It is drawn in scene units with the dial toward +z. Its children are what
 * it weighs, placed in millimetres from the middle of the pan's floor.
 *
 * @param grams - The load on the pan, in grams
 * @param full - The load at full scale, in grams
 * @param major - The step between numbered ticks, in grams
 * @param minor - The step between ticks, in grams
 */
export function Balance({
  children,
  full,
  grams,
  major,
  minor,
}: {
  readonly children?: ReactNode;
  readonly full: number;
  readonly grams: number;
  readonly major: number;
  readonly minor: number;
}) {
  const needle = useRef<Group>(null);
  const format = usePrintNumber();
  const dial = useMemo(
    () => ({
      centre: [0, 0] as const,
      radius: DIAL.radius - 5,
      scale: { from: 0, major, minor, to: full },
      sweep: SWEEP,
    }),
    [full, major, minor]
  );
  const sheet = useMemo(
    () => ({
      ground: INSTRUMENT_COLORS.dialFace,
      height: DIAL.radius * 2,
      marks: [
        ...dialMarks(dial, format, {
          ink: INSTRUMENT_COLORS.scaleInk,
          numbered: true,
        }),
        words({
          at: [0, DIAL.radius * 0.24],
          ink: INSTRUMENT_COLORS.scaleInk,
          size: DIAL.radius * 0.2,
          text: "g",
        }),
      ],
      width: DIAL.radius * 2,
    }),
    [dial, format]
  );

  useGlide(grams, SETTLE, (load) => {
    needle.current?.rotation.set(0, 0, dialAngle(dial, load));
  });

  return (
    <group scale={MILLIMETRE}>
      {Arr.map(FEET, ([across, along]) => (
        <mesh
          castShadow
          key={`${across} ${along}`}
          position={[
            across * (BODY.wide / 2 - 16),
            2.5,
            along * (BODY.deep / 2 - 16),
          ]}
        >
          <cylinderGeometry args={[7, 8, 5, 24]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.gripPad}
            roughness={0.85}
            surface="rubber"
          />
        </mesh>
      ))}
      <RoundedBox
        args={[BODY.wide, BODY.tall - 5, BODY.deep]}
        castShadow
        position={[0, 5 + (BODY.tall - 5) / 2, 0]}
        radius={9}
        receiveShadow
        smoothness={6}
      >
        <SurfaceMaterial
          coat={0.5}
          color={INSTRUMENT_COLORS.hammertone}
          repeat={[5, 3]}
          roughness={0.5}
          surface="cast"
        />
      </RoundedBox>
      <group position={[0, DIAL.middle, BODY.deep / 2]}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <latheGeometry args={[BEZEL_PROFILE, 96]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.satinChrome}
            metalness={1}
            repeat={[8, 1]}
            roughness={0.22}
            surface="brushed"
          />
        </mesh>
        <group position={[0, 0, 0.6]}>
          <PrintDisc sheet={sheet} stock="ink" />
        </group>
        <group position={[0, 0, 2.2]} ref={needle}>
          <mesh position={[DIAL.radius * 0.32, 0, 0]}>
            <boxGeometry args={[DIAL.radius * 1.08, 0.9, 0.4]} />
            <meshStandardMaterial
              color={INSTRUMENT_COLORS.dialNeedle}
              roughness={0.4}
            />
          </mesh>
        </group>
        <mesh position={[0, 0, 2.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2.6, 3, 1.4, 32]} />
          <Stainless />
        </mesh>
        <mesh position={[0, 0, 4.6]}>
          <circleGeometry args={[DIAL.radius + 1.6, 96]} />
          <GlassMaterial color={INSTRUMENT_COLORS.crystal} opacity={0.1} />
        </mesh>
      </group>
      <mesh castShadow position={[0, BODY.tall + PAN.lift / 2 - 1, 0]}>
        <cylinderGeometry args={[9, 12, PAN.lift, 40]} />
        <Stainless />
      </mesh>
      <group position={[0, BODY.tall + PAN.lift, 0]}>
        <mesh castShadow receiveShadow>
          <latheGeometry args={[PAN_PROFILE, 128]} />
          <Stainless />
        </mesh>
        {children}
      </group>
    </group>
  );
}
