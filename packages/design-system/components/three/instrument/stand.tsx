import { RoundedBox } from "@react-three/drei";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import type { ReactNode } from "react";

/** The base: how wide, thick and deep the cast foot is, in millimetres. */
const BASE = { deep: 150, thick: 16, wide: 250 } as const;

/** The radius of the upright rod and of the rods it carries, in millimetres. */
const ROD = { arm: 5, upright: 6 } as const;

/** How far the crossbar of a gantry hangs under its arms, and how far it runs past them, in millimetres. */
const BAR = { drop: 12, past: 34 } as const;

/** Bright steel, drawn along a rod. */
function Steel() {
  return (
    <SurfaceMaterial
      bump={0.3}
      color={INSTRUMENT_COLORS.satinChrome}
      metalness={1}
      repeat={[2, 12]}
      roughness={0.28}
      surface="brushed"
    />
  );
}

/** The cast aluminium of a boss head. */
function Alloy() {
  return (
    <SurfaceMaterial
      color={INSTRUMENT_COLORS.aluminium}
      metalness={0.9}
      repeat={[2, 2]}
      roughness={0.5}
      surface="cast"
    />
  );
}

/** A knurled thumbscrew of a boss head, its axis along y. */
function Thumbscrew() {
  return (
    <group>
      <mesh castShadow position={[0, 7, 0]}>
        <cylinderGeometry args={[2.6, 2.6, 14, 20]} />
        <Steel />
      </mesh>
      <mesh castShadow position={[0, 17, 0]}>
        <cylinderGeometry args={[8, 8, 7, 48]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.satinChrome}
          metalness={1}
          repeat={[10, 1]}
          roughness={0.36}
          surface="knurl"
        />
      </mesh>
    </group>
  );
}

/**
 * A retort stand on the bench: a cast iron foot, a steel rod `tall`
 * millimetres high, and a boss head with its two thumbscrews that holds an
 * arm `rise` millimetres over the bench, reaching `reach` millimetres toward
 * the reader.
 *
 * It is drawn in scene units with the end of its arm over the origin. Its
 * children are what the arm holds, placed in scene units from the middle of
 * the arm's end.
 *
 * @param reach - How far the arm reaches from the rod, in millimetres
 * @param rise - How high the arm is over the bench, in millimetres
 * @param tall - How tall the rod is, in millimetres
 */
export function Stand({
  children,
  reach,
  rise,
  tall,
}: {
  readonly children: ReactNode;
  readonly reach: number;
  readonly rise: number;
  readonly tall: number;
}) {
  return (
    <group>
      <group scale={MILLIMETRE}>
        <RoundedBox
          args={[BASE.wide, BASE.thick, BASE.deep]}
          castShadow
          position={[0, BASE.thick / 2, 40 - reach]}
          radius={3}
          receiveShadow
          smoothness={4}
        >
          <SurfaceMaterial
            coat={0.3}
            color={APPARATUS_COLORS.caseDark}
            repeat={[5, 3]}
            roughness={0.5}
            surface="cast"
          />
        </RoundedBox>
        <mesh castShadow position={[0, BASE.thick + 9, -reach]}>
          <cylinderGeometry args={[11, 14, 18, 40]} />
          <SurfaceMaterial
            coat={0.3}
            color={APPARATUS_COLORS.caseDark}
            repeat={[4, 1]}
            roughness={0.5}
            surface="cast"
          />
        </mesh>
        <mesh castShadow position={[0, tall / 2, -reach]}>
          <cylinderGeometry args={[ROD.upright, ROD.upright, tall, 32]} />
          <Steel />
        </mesh>
        <group position={[0, rise, -reach]}>
          <RoundedBox args={[26, 30, 34]} castShadow radius={3} smoothness={4}>
            <Alloy />
          </RoundedBox>
          <group position={[13, 0, -6]} rotation={[0, 0, -Math.PI / 2]}>
            <Thumbscrew />
          </group>
          <group position={[0, 15, 15]}>
            <Thumbscrew />
          </group>
          <mesh
            castShadow
            position={[0, 0, reach / 2 + 4]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[ROD.arm, ROD.arm, reach + 30, 28]} />
            <Steel />
          </mesh>
        </group>
      </group>
      <group position={[0, rise * MILLIMETRE, 0]}>{children}</group>
    </group>
  );
}

/** The boss head that joins the crossbar of a gantry to the end of an arm, in millimetres. */
function Joint() {
  return (
    <group scale={MILLIMETRE}>
      <RoundedBox
        args={[30, 34, 30]}
        castShadow
        position={[0, -BAR.drop / 2, 2]}
        radius={3}
        smoothness={4}
      >
        <Alloy />
      </RoundedBox>
      <group position={[0, 11 - BAR.drop / 2, 8]}>
        <Thumbscrew />
      </group>
      <group position={[8, 2, 17]} rotation={[Math.PI / 2, 0, 0]}>
        <Thumbscrew />
      </group>
    </group>
  );
}

/**
 * A gantry on the bench: two retort stands `wide` millimetres apart whose
 * arms carry one steel crossbar, joined to each arm by a boss head. What
 * hangs from the bar swings clear of both rods.
 *
 * It is drawn in scene units with the middle of the crossbar over the
 * origin. Its children hang from the bar, placed in scene units from the
 * middle of its underside.
 *
 * @param reach - How far the arms reach from the rods, in millimetres
 * @param rise - How high the underside of the crossbar is over the bench, in millimetres
 * @param wide - How far apart the stands are, in millimetres
 */
export function Gantry({
  children,
  reach,
  rise,
  wide,
}: {
  readonly children: ReactNode;
  readonly reach: number;
  readonly rise: number;
  readonly wide: number;
}) {
  const arm = rise + ROD.arm + BAR.drop;

  return (
    <group>
      <group position={[(-wide / 2) * MILLIMETRE, 0, 0]}>
        <Stand reach={reach} rise={arm} tall={arm + 46}>
          <Joint />
        </Stand>
      </group>
      <group position={[(wide / 2) * MILLIMETRE, 0, 0]}>
        <Stand reach={reach} rise={arm} tall={arm + 46}>
          <Joint />
        </Stand>
      </group>
      <group scale={MILLIMETRE}>
        <mesh
          castShadow
          position={[0, rise + ROD.arm, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry
            args={[ROD.arm, ROD.arm, wide + BAR.past * 2, 28]}
          />
          <Steel />
        </mesh>
      </group>
      <group position={[0, rise * MILLIMETRE, 0]}>{children}</group>
    </group>
  );
}
