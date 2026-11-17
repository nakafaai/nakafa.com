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
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";

/**
 * The lines of a handysize bulk carrier, in scene units of ten metres: a long
 * parallel body with a boxy midship section and a tight bilge, a short bow
 * and a modest sheer, as a ship built to carry the most cargo is.
 */
const LINES: HullLines = {
  beam: 1.32,
  bow: 0.2,
  depth: 0.78,
  forefoot: 0.25,
  length: 8.6,
  rake: 0.3,
  run: 0.16,
  sheer: 0.12,
  square: 9,
  transom: 0.72,
};

/** The height of the loaded waterline on the hull, which the boot top follows. */
const SHIP_WATERLINE = 0.38;

/** The deck's height amidships. */
const DECK = deckAt(LINES, 0);

/** Where the five cargo holds' hatches stand along the deck. */
const HATCHES = Arr.makeBy(5, (index) => -2.3 + index * 1.2);

/** The four deck cranes, one between each pair of hatches. */
const CRANES = Arr.makeBy(4, (index) => -1.7 + index * 1.2);

/** The stiffening ribs across the top of each hatch cover. */
const RIBS: readonly Placement[] = Arr.flatMap(HATCHES, (x) =>
  Arr.makeBy(6, (index) => ({
    position: [x - 0.38 + index * 0.152, DECK + 0.19, 0],
  }))
);

/** The accommodation block aft: where it stands, how long, wide and tall it is. */
const HOUSE = { height: 1.05, length: 0.85, width: 1, x: -3.45 } as const;

/** The windows of the accommodation: rows across its front, one row a deck. */
const WINDOWS: readonly Placement[] = Arr.flatMap(Arr.range(0, 3), (deck) =>
  Arr.makeBy(6, (index) => ({
    position: [
      HOUSE.x + HOUSE.length / 2 + 0.004,
      DECK + 0.2 + deck * 0.22,
      -0.36 + index * 0.144,
    ],
  }))
);

/** The windows along both sides of the accommodation. */
const SIDE_WINDOWS: readonly Placement[] = Arr.flatMap(
  Arr.range(0, 3),
  (deck) =>
    Arr.flatMap(
      Arr.makeBy(4, (index) => HOUSE.x - 0.27 + index * 0.18),
      (x) =>
        Arr.map([-1, 1], (side) => ({
          position: [
            x,
            DECK + 0.2 + deck * 0.22,
            side * (HOUSE.width / 2 + 0.004),
          ],
          rotation: [0, Math.PI / 2, 0],
        }))
    )
);

/** The stanchions of the deck rail, along both sides. */
const STANCHIONS: readonly Placement[] = Arr.flatMap(
  Arr.makeBy(40, (index) => -4.1 + index * 0.21),
  (x) =>
    Arr.map([-1, 1], (side) => ({
      position: [x, deckAt(LINES, x) + 0.05, side * (halfAt(LINES, x) - 0.015)],
    }))
);

/** One deck crane: a pedestal, the operator's house, and its jib stowed at an angle over the hatch ahead. */
function Crane({ x }: { readonly x: number }) {
  return (
    <group position={[x, DECK, 0]}>
      <mesh castShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.075, 0.09, 0.4, 20]} />
        <SurfaceMaterial color={MACHINE_COLORS.craneYellow} surface="paint" />
      </mesh>
      <RoundedBox
        args={[0.24, 0.2, 0.2]}
        castShadow
        position={[0, 0.5, 0]}
        radius={0.02}
        smoothness={2}
      >
        <SurfaceMaterial color={MACHINE_COLORS.craneYellow} surface="paint" />
      </RoundedBox>
      <mesh position={[0.121, 0.53, 0]}>
        <boxGeometry args={[0.004, 0.08, 0.14]} />
        <meshStandardMaterial
          color={CAR_COLORS.tintedGlass}
          metalness={0.3}
          roughness={0.06}
        />
      </mesh>
      <mesh castShadow position={[0.5, 0.66, 0]} rotation={[0, 0, 0.32]}>
        <boxGeometry args={[1.05, 0.05, 0.06]} />
        <SurfaceMaterial color={MACHINE_COLORS.craneYellow} surface="paint" />
      </mesh>
    </group>
  );
}

/**
 * A handysize bulk carrier, faired from its lines: a navy hull with a red
 * antifouling bottom, a deck in green deck paint with five hatch covers and
 * four yellow cranes, the white accommodation block aft with rows of
 * windows and the bridge wings across its top, the funnel behind it, a
 * foremast at the bow, and a rail along both sides. It lies along +x with
 * its waterline at zero.
 */
export function Ship() {
  const rail = deckEdge(LINES, 0.1, -0.015);
  const houseTop = DECK + HOUSE.height;

  return (
    <group position={[0, -SHIP_WATERLINE, 0]}>
      <Hull
        boot={SHIP_WATERLINE + 0.03}
        bottom={MACHINE_COLORS.hullRed}
        deck={MACHINE_COLORS.deckGreen}
        lines={LINES}
        topside={MACHINE_COLORS.hullNavy}
      />
      <Strake
        color={MACHINE_COLORS.deckWhite}
        points={rail}
        radius={0.007}
        surface="paint"
      />
      <Repeat placements={STANCHIONS}>
        <cylinderGeometry args={[0.005, 0.005, 0.1, 6]} />
        <meshStandardMaterial
          color={MACHINE_COLORS.deckWhite}
          roughness={0.5}
        />
      </Repeat>

      {Arr.map(HATCHES, (x) => (
        <RoundedBox
          args={[0.95, 0.18, 0.92]}
          castShadow
          key={x}
          position={[x, DECK + 0.09, 0]}
          radius={0.025}
          receiveShadow
          smoothness={2}
        >
          <SurfaceMaterial color={MACHINE_COLORS.hullRed} surface="paint" />
        </RoundedBox>
      ))}
      <Repeat placements={RIBS}>
        <boxGeometry args={[0.025, 0.02, 0.88]} />
        <SurfaceMaterial color={MACHINE_COLORS.hullRed} surface="paint" />
      </Repeat>
      {Arr.map(CRANES, (x) => (
        <Crane key={x} x={x} />
      ))}

      <RoundedBox
        args={[HOUSE.length, HOUSE.height, HOUSE.width]}
        castShadow
        position={[HOUSE.x, DECK + HOUSE.height / 2, 0]}
        radius={0.03}
        receiveShadow
        smoothness={3}
      >
        <SurfaceMaterial color={MACHINE_COLORS.deckWhite} surface="paint" />
      </RoundedBox>
      <Repeat placements={WINDOWS}>
        <boxGeometry args={[0.008, 0.07, 0.09]} />
        <meshStandardMaterial
          color={CAR_COLORS.tintedGlass}
          metalness={0.3}
          roughness={0.06}
        />
      </Repeat>
      <Repeat placements={SIDE_WINDOWS}>
        <boxGeometry args={[0.008, 0.07, 0.09]} />
        <meshStandardMaterial
          color={CAR_COLORS.tintedGlass}
          metalness={0.3}
          roughness={0.06}
        />
      </Repeat>
      <RoundedBox
        args={[0.6, 0.18, 1.42]}
        castShadow
        position={[HOUSE.x + 0.08, houseTop + 0.09, 0]}
        radius={0.02}
        receiveShadow
        smoothness={2}
      >
        <SurfaceMaterial color={MACHINE_COLORS.deckWhite} surface="paint" />
      </RoundedBox>
      <mesh position={[HOUSE.x + 0.381, houseTop + 0.1, 0]}>
        <boxGeometry args={[0.006, 0.08, 1.3]} />
        <meshStandardMaterial
          color={CAR_COLORS.tintedGlass}
          metalness={0.3}
          roughness={0.06}
        />
      </mesh>
      <mesh castShadow position={[HOUSE.x, houseTop + 0.42, 0]}>
        <cylinderGeometry args={[0.012, 0.018, 0.5, 8]} />
        <SurfaceMaterial color={MACHINE_COLORS.deckWhite} surface="paint" />
      </mesh>

      <group position={[HOUSE.x - 0.22, houseTop + 0.32, 0]}>
        <mesh castShadow rotation={[0, 0, 0.06]} scale={[1.2, 1, 0.8]}>
          <cylinderGeometry args={[0.15, 0.18, 0.6, 24]} />
          <SurfaceMaterial color={MACHINE_COLORS.stackBuff} surface="paint" />
        </mesh>
        <mesh
          position={[0.02, 0.28, 0]}
          rotation={[0, 0, 0.06]}
          scale={[1.2, 1, 0.8]}
        >
          <cylinderGeometry args={[0.152, 0.152, 0.08, 24]} />
          <SurfaceMaterial color={CAR_COLORS.tyre} surface="paint" />
        </mesh>
      </group>

      <mesh castShadow position={[3.7, deckAt(LINES, 3.7) + 0.35, 0]}>
        <cylinderGeometry args={[0.014, 0.022, 0.7, 8]} />
        <SurfaceMaterial color={MACHINE_COLORS.craneYellow} surface="paint" />
      </mesh>
    </group>
  );
}
