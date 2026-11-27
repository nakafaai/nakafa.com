import { RoundedBox } from "@react-three/drei";
import type { Placement } from "@repo/design-system/components/three/repeat";
import { Repeat } from "@repo/design-system/components/three/repeat";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

/** The door's height and thickness, the wall's thickness and height, in metres. */
export const DOOR = { height: 2.03, thick: 0.04 } as const;
const WALL = { height: 2.5, left: 1.5, right: 1.7, thick: 0.11 } as const;

/** The gap the frame leaves round the door, and the thickness of the frame's lining. */
const GAP = 0.003;
const LINING = 0.03;

/** The width of the door's stiles, and its rails from the floor up: bottom, lock and top. */
const STILE = 0.1;
const RAILS = [
  { at: 0.1, tall: 0.2 },
  { at: 0.95, tall: 0.16 },
  { at: DOOR.height - 0.055, tall: 0.11 },
] as const;

/** The two panels between the rails: where each one's middle is and how tall it is. */
const PANELS = [
  { at: 0.535, tall: 0.67 },
  { at: 1.475, tall: 0.89 },
] as const;

/** The height of the handle and how far it sits from the door's free edge. */
export const HANDLE = { height: 1.02, inset: 0.065 } as const;

/** Where the three hinges sit up the door. */
const HINGES: readonly Placement[] = Arr.map([0.22, 1.02, 1.82], (y) => ({
  position: [0, y, -DOOR.thick / 2 - 0.006],
}));

/** The door's oak, its grain laid `across` by `along` tiles. */
function Oak({
  across,
  along,
}: {
  readonly across: number;
  readonly along: number;
}) {
  return (
    <SurfaceMaterial
      coat={0.35}
      color={INSTRUMENT_COLORS.oak}
      repeat={[across, along]}
      surface="wood"
    />
  );
}

/** The satin white paint of the frame, the architrave and the skirting. */
function Gloss() {
  return (
    <SurfaceMaterial
      coat={0.3}
      color={MACHINE_COLORS.dialWhite}
      surface="paint"
    />
  );
}

/** The satin steel of the handle and the hinges. */
function Steel() {
  return (
    <SurfaceMaterial
      color={CAR_COLORS.chrome}
      metalness={1}
      roughness={0.6}
      surface="brushed"
    />
  );
}

/** A lever handle on its rose, on the face of the door that looks toward +z. */
function Lever() {
  const lever = useMemo(
    () =>
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(0, 0, 0),
          new Vector3(0, 0, 0.034),
          new Vector3(-0.01, 0, 0.046),
          new Vector3(-0.035, 0, 0.05),
          new Vector3(-0.125, 0, 0.05),
        ]),
        40,
        0.0085,
        16
      ),
    []
  );
  useEffect(() => () => lever.dispose(), [lever]);

  return (
    <group>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.026, 0.027, 0.009, 40]} />
        <Steel />
      </mesh>
      <mesh castShadow geometry={lever}>
        <Steel />
      </mesh>
      <mesh castShadow position={[-0.125, 0, 0.05]}>
        <sphereGeometry args={[0.0085, 16, 12]} />
        <Steel />
      </mesh>
    </group>
  );
}

/**
 * The door itself, hung on the origin's hinge line and lying along +x: a
 * framed oak door of two stiles and three rails with raised panels between
 * them, and a lever handle on each face. The scene turns it on its hinges.
 *
 * @param width - The door's width, in metres
 */
export function Leaf({ width }: { readonly width: number }) {
  const inner = width - 2 * (STILE + GAP);

  return (
    <group>
      {Arr.map([GAP + STILE / 2, width - GAP - STILE / 2], (x) => (
        <RoundedBox
          args={[STILE, DOOR.height - 2 * GAP, DOOR.thick]}
          castShadow
          key={x}
          position={[x, DOOR.height / 2, 0]}
          radius={0.003}
          receiveShadow
          smoothness={2}
        >
          <Oak across={1} along={6} />
        </RoundedBox>
      ))}
      {Arr.map(RAILS, (rail) => (
        <RoundedBox
          args={[inner, rail.tall - GAP, DOOR.thick - 0.002]}
          castShadow
          key={rail.at}
          position={[width / 2, rail.at, 0]}
          radius={0.003}
          receiveShadow
          smoothness={2}
        >
          <Oak across={3} along={1} />
        </RoundedBox>
      ))}
      {Arr.map(PANELS, (panel) => (
        <group key={panel.at} position={[width / 2, panel.at, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[inner + 0.01, panel.tall + 0.01, 0.014]} />
            <Oak across={2} along={4} />
          </mesh>
          <RoundedBox
            args={[inner - 0.07, panel.tall - 0.07, 0.03]}
            castShadow
            radius={0.008}
            receiveShadow
            smoothness={3}
          >
            <Oak across={2} along={4} />
          </RoundedBox>
        </group>
      ))}
      <group position={[width - HANDLE.inset, HANDLE.height, DOOR.thick / 2]}>
        <Lever />
      </group>
      <group
        position={[width - HANDLE.inset, HANDLE.height, -DOOR.thick / 2]}
        scale={[1, 1, -1]}
      >
        <Lever />
      </group>
    </group>
  );
}

/**
 * The wall the door hangs in, standing on the floor with the hinge line on
 * the origin: plastered wall to both sides and over the head, the painted
 * lining and architrave of the frame, skirting along the floor, the barrels
 * of three butt hinges, and a light switch beside the handle.
 *
 * @param width - The door's width, in metres
 */
export function Doorway({ width }: { readonly width: number }) {
  const lead = width + 2 * LINING;
  const head = DOOR.height + LINING;
  const sides = [
    { middle: -LINING - WALL.left / 2, wide: WALL.left },
    { middle: width + LINING + WALL.right / 2, wide: WALL.right },
  ] as const;

  return (
    <group>
      {Arr.map(sides, (side) => (
        <group key={side.middle}>
          <mesh
            castShadow
            position={[side.middle, WALL.height / 2, 0]}
            receiveShadow
          >
            <boxGeometry args={[side.wide, WALL.height, WALL.thick]} />
            <SurfaceMaterial
              color={ENERGY_COLORS.wallPlaster}
              roughness={0.92}
              surface="paint"
            />
          </mesh>
          {Arr.map([-1, 1], (face) => (
            <RoundedBox
              args={[side.wide, 0.1, 0.014]}
              castShadow
              key={face}
              position={[side.middle, 0.05, face * (WALL.thick / 2 + 0.007)]}
              radius={0.004}
              smoothness={2}
            >
              <Gloss />
            </RoundedBox>
          ))}
        </group>
      ))}
      <mesh
        castShadow
        position={[width / 2, (WALL.height + head) / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[lead, WALL.height - head, WALL.thick]} />
        <SurfaceMaterial
          color={ENERGY_COLORS.wallPlaster}
          roughness={0.92}
          surface="paint"
        />
      </mesh>
      {Arr.map([-LINING / 2, width + LINING / 2], (x) => (
        <group key={x}>
          <mesh castShadow position={[x, head / 2, 0]} receiveShadow>
            <boxGeometry args={[LINING, head, WALL.thick + 0.004]} />
            <Gloss />
          </mesh>
          {Arr.map([-1, 1], (face) => (
            <RoundedBox
              args={[0.07, head + 0.035, 0.016]}
              castShadow
              key={face}
              position={[
                x + Math.sign(x - width / 2) * 0.02,
                (head + 0.035) / 2,
                face * (WALL.thick / 2 + 0.008),
              ]}
              radius={0.005}
              smoothness={3}
            >
              <Gloss />
            </RoundedBox>
          ))}
        </group>
      ))}
      <mesh castShadow position={[width / 2, head - LINING / 2, 0]}>
        <boxGeometry args={[width, LINING, WALL.thick + 0.004]} />
        <Gloss />
      </mesh>
      {Arr.map([-1, 1], (face) => (
        <RoundedBox
          args={[lead + 0.11, 0.07, 0.016]}
          castShadow
          key={face}
          position={[width / 2, head + 0.035, face * (WALL.thick / 2 + 0.008)]}
          radius={0.005}
          smoothness={3}
        >
          <Gloss />
        </RoundedBox>
      ))}
      <Repeat placements={HINGES}>
        <cylinderGeometry args={[0.0065, 0.0065, 0.1, 16]} />
        <Steel />
      </Repeat>
      <group position={[width + 0.28, 1.2, WALL.thick / 2]}>
        <RoundedBox
          args={[0.086, 0.086, 0.01]}
          castShadow
          position={[0, 0, 0.005]}
          radius={0.004}
          smoothness={3}
        >
          <SurfaceMaterial color={MACHINE_COLORS.dialWhite} surface="plastic" />
        </RoundedBox>
        <RoundedBox
          args={[0.03, 0.048, 0.008]}
          position={[0, 0, 0.012]}
          radius={0.003}
          rotation={[0.12, 0, 0]}
          smoothness={3}
        >
          <SurfaceMaterial color={MACHINE_COLORS.dialWhite} surface="plastic" />
        </RoundedBox>
      </group>
    </group>
  );
}
