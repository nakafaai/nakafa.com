import { RoundedBox } from "@react-three/drei";
import { Hull } from "@repo/design-system/components/contents/physics/vector/tugboat/hull";
import {
  type Placement,
  Repeat,
} from "@repo/design-system/components/three/repeat";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  deckAt,
  deckEdge,
  type HullLines,
  halfAt,
} from "@repo/design-system/components/three/vessel/hull";
import { Strake } from "@repo/design-system/components/three/vessel/strake";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";

/**
 * The lines of a harbour tug of about 26 m, in scene units of ten metres: a
 * beamy, deep hull with a high sheer forward, a raked stem and a broad
 * transom, as a tug with azimuth thrusters aft is built.
 */
const LINES: HullLines = {
  beam: 1,
  bow: 0.4,
  depth: 0.5,
  forefoot: 0.45,
  length: 2.6,
  rake: 0.55,
  run: 0.12,
  sheer: 0.45,
  square: 5,
  transom: 0.85,
};

/** The height of the waterline on the tug's hull, which the boot top follows. */
const TUG_WATERLINE = 0.24;

/** How far behind the tug's middle its towing staple stands, where the cable is made fast. */
export const TUG_STAPLE = 1.12;

/** The height of the towing staple above the tug's waterline. */
export const TUG_STAPLE_RISE = deckAt(LINES, -TUG_STAPLE) + 0.1 - TUG_WATERLINE;

/** The deck's height under the deckhouse. */
const DECK = deckAt(LINES, 0.15);

/** The top of the deckhouse, where the wheelhouse and the stacks stand. */
const HOUSE_TOP = DECK + 0.26;

/** Old tyres hung along each side as fenders, against the topsides under the strake. */
const TYRES: readonly Placement[] = Arr.flatMap(
  Arr.makeBy(6, (index) => -0.95 + index * 0.33),
  (x) =>
    Arr.map([-1, 1], (side) => ({
      position: [x, deckAt(LINES, x) - 0.17, side * (halfAt(LINES, x) + 0.035)],
      rotation: [side * 0.18, 0, 0],
    }))
);

/** The heavy cylindrical fenders stacked on the stem, for pushing. */
const BOW_FENDERS: readonly Placement[] = Arr.makeBy(3, (index) => ({
  position: [
    LINES.length / 2 + 0.18 - index * 0.07,
    deckAt(LINES, 1.2) - 0.06 - index * 0.13,
    0,
  ],
  rotation: [Math.PI / 2, 0, 0],
}));

/** The stanchions of the deck rail, along both sides from the quarters to the bow. */
const STANCHIONS: readonly Placement[] = Arr.flatMap(
  Arr.makeBy(14, (index) => -1.15 + index * 0.17),
  (x) =>
    Arr.map([-1, 1], (side) => ({
      position: [x, deckAt(LINES, x) + 0.05, side * (halfAt(LINES, x) - 0.02)],
    }))
);

/** The window posts of the wheelhouse: across its front and along both sides. */
const MULLIONS: readonly Placement[] = Arr.appendAll(
  Arr.makeBy(5, (index) => ({
    position: [0.61, HOUSE_TOP + 0.2, -0.24 + index * 0.12],
  })),
  Arr.flatMap(
    Arr.makeBy(4, (index) => 0.08 + index * 0.13),
    (x) =>
      Arr.map([-1, 1], (side) => ({
        position: [x, HOUSE_TOP + 0.2, side * 0.31],
        rotation: [0, Math.PI / 2, 0],
      }))
  )
);

/** A navigation light: a small lens that glows its colour. */
function Light({
  color,
  position,
}: {
  readonly color: string;
  readonly position: readonly [number, number, number];
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.018, 12, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2.4}
        roughness={0.3}
      />
    </mesh>
  );
}

/**
 * A harbour tug of about 26 m, faired from its lines: a red hull with an
 * antifouling bottom, a black rubber strake along the sheer with old tyres
 * hung under it and heavy fenders on the stem, a white deckhouse with the
 * glazed wheelhouse on top, a mast with its navigation lights, twin buff
 * stacks with black tops, the towing winch and staple aft, and a rail along
 * the deck edge. It lies along +x with its waterline at zero.
 */
export function Tug() {
  const strake = deckEdge(LINES, -0.06, 0.03);
  const rail = deckEdge(LINES, 0.11, -0.02);

  return (
    <group position={[0, -TUG_WATERLINE, 0]}>
      <Hull
        boot={TUG_WATERLINE + 0.02}
        bottom={MATERIAL.antifouling}
        deck={MATERIAL.concrete}
        lines={LINES}
        topside={MATERIAL.hullRed}
      />
      <Strake
        color={MATERIAL.tyre}
        points={strake}
        radius={0.055}
        surface="rubber"
      />
      <Strake
        color={MATERIAL.deckWhite}
        points={rail}
        radius={0.009}
        surface="paint"
      />
      <Repeat placements={TYRES}>
        <torusGeometry args={[0.07, 0.034, 10, 20]} />
        <SurfaceMaterial color={MATERIAL.tyre} surface="rubber" />
      </Repeat>
      <Repeat placements={BOW_FENDERS}>
        <cylinderGeometry args={[0.07, 0.07, 0.56, 18]} />
        <SurfaceMaterial color={MATERIAL.tyre} surface="rubber" />
      </Repeat>
      <Repeat placements={STANCHIONS}>
        <cylinderGeometry args={[0.006, 0.006, 0.12, 6]} />
        <meshStandardMaterial color={MATERIAL.deckWhite} roughness={0.5} />
      </Repeat>

      <RoundedBox
        args={[1, 0.26, 0.7]}
        castShadow
        position={[0.12, DECK + 0.13, 0]}
        radius={0.03}
        receiveShadow
        smoothness={3}
      >
        <SurfaceMaterial color={MATERIAL.deckWhite} surface="paint" />
      </RoundedBox>
      <RoundedBox
        args={[0.6, 0.28, 0.6]}
        castShadow
        position={[0.32, HOUSE_TOP + 0.14, 0]}
        radius={0.025}
        receiveShadow
        smoothness={3}
      >
        <SurfaceMaterial color={MATERIAL.deckWhite} surface="paint" />
      </RoundedBox>
      <RoundedBox
        args={[0.62, 0.12, 0.62]}
        position={[0.32, HOUSE_TOP + 0.2, 0]}
        radius={0.02}
        smoothness={2}
      >
        <meshStandardMaterial
          color={MATERIAL.tintedGlass}
          metalness={0.3}
          roughness={0.06}
        />
      </RoundedBox>
      <Repeat placements={MULLIONS}>
        <boxGeometry args={[0.012, 0.13, 0.012]} />
        <meshStandardMaterial color={MATERIAL.deckWhite} roughness={0.5} />
      </Repeat>
      <RoundedBox
        args={[0.72, 0.035, 0.68]}
        castShadow
        position={[0.34, HOUSE_TOP + 0.3, 0]}
        radius={0.012}
        smoothness={2}
      >
        <SurfaceMaterial color={MATERIAL.deckWhite} surface="paint" />
      </RoundedBox>

      <group position={[0.26, HOUSE_TOP + 0.31, 0]}>
        <mesh castShadow position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.01, 0.016, 0.44, 8]} />
          <SurfaceMaterial color={MATERIAL.deckWhite} surface="paint" />
        </mesh>
        <mesh castShadow position={[0, 0.34, 0]}>
          <boxGeometry args={[0.02, 0.016, 0.34]} />
          <SurfaceMaterial color={MATERIAL.deckWhite} surface="paint" />
        </mesh>
        <Light color={MATERIAL.signalRed} position={[0.02, 0.36, -0.16]} />
        <Light color={MATERIAL.signalGreen} position={[0.02, 0.36, 0.16]} />
        <Light color={getColor("WHITE")} position={[0.02, 0.45, 0]} />
      </group>

      {Arr.map([-1, 1], (side) => (
        <group key={side} position={[-0.2, HOUSE_TOP, side * 0.17]}>
          <mesh castShadow position={[0, 0.17, 0]} rotation={[0, 0, 0.08]}>
            <cylinderGeometry args={[0.055, 0.062, 0.34, 18]} />
            <SurfaceMaterial color={MATERIAL.stackBuff} surface="paint" />
          </mesh>
          <mesh position={[0.014, 0.35, 0]} rotation={[0, 0, 0.08]}>
            <cylinderGeometry args={[0.057, 0.057, 0.05, 18]} />
            <SurfaceMaterial color={MATERIAL.tyre} surface="paint" />
          </mesh>
        </group>
      ))}

      <group position={[-0.62, deckAt(LINES, -0.62), 0]}>
        {Arr.map([-1, 1], (side) => (
          <RoundedBox
            args={[0.2, 0.18, 0.03]}
            castShadow
            key={side}
            position={[0, 0.09, side * 0.17]}
            radius={0.01}
            smoothness={2}
          >
            <SurfaceMaterial color={MATERIAL.hullNavy} surface="paint" />
          </RoundedBox>
        ))}
        <mesh castShadow position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.068, 0.068, 0.3, 20]} />
          <SurfaceMaterial
            color={MATERIAL.hemp}
            repeat={[6, 3]}
            surface="cloth"
          />
        </mesh>
      </group>
      <mesh
        castShadow
        position={[-TUG_STAPLE, deckAt(LINES, -TUG_STAPLE), 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <torusGeometry args={[0.13, 0.02, 8, 20, Math.PI]} />
        <SurfaceMaterial color={MATERIAL.hullNavy} surface="paint" />
      </mesh>
    </group>
  );
}
