import { groundAt } from "@repo/design-system/components/contents/biology/climate/sea";
import type { Placement } from "@repo/design-system/components/contents/biology/instances";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { getColor } from "@repo/design-system/lib/color";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr } from "effect";

/**
 * The kampung's plank boardwalk, a titian, runs down the lane between the
 * two rows of houses from the grass to the front of the village, its deck
 * 0.9 m above today's high tide, 1.8 m wide.
 */
const WALK = { deck: 0.9, land: 18, sea: -18, width: 1.8, z: -1.7 } as const;

/** The edges of the deck, where its stringers and piles stand. */
const EDGES = [WALK.z - 0.8, WALK.z + 0.8] as const;

/** The deck's planks, laid across it with a finger's gap, each a little out of line. */
const PLANKS: readonly Placement[] = Arr.map(
  Arr.range(0, Math.floor((WALK.land - WALK.sea) / 0.23) - 1),
  (index) => ({
    position: [
      WALK.sea + 0.1 + index * 0.23,
      WALK.deck - 0.025,
      WALK.z + (hashUnit(index, 4) - 0.5) * 0.06,
    ],
    rotation: [0, (hashUnit(index, 5) - 0.5) * 0.03, 0],
  })
);

/** The piles in pairs every 2.5 m, driven 0.8 m into the sand or the seabed. */
const PILES: readonly Placement[] = Arr.flatMap(
  Arr.range(0, Math.floor((WALK.land - WALK.sea) / 2.5)),
  (index) => {
    const x = WALK.sea + 0.3 + index * 2.5;
    const bottom = groundAt(x) - 0.8;
    const top = WALK.deck - 0.17;
    return Arr.map(EDGES, (z) => ({
      position: [x, (top + bottom) / 2, z],
      scale: [1, top - bottom, 1],
    }));
  }
);

/** The two stringers under the deck. */
const STRINGERS: readonly Placement[] = Arr.map(EDGES, (z) => ({
  position: [(WALK.land + WALK.sea) / 2, WALK.deck - 0.11, z],
}));

/** The boardwalk: weathered planks on two stringers over paired timber piles. */
export function Boardwalk() {
  return (
    <group>
      <Instances placements={PLANKS}>
        <boxGeometry args={[0.2, 0.05, WALK.width]} />
        <meshStandardMaterial
          color={ECOLOGY_COLORS.woodWeathered}
          roughness={0.9}
        />
      </Instances>
      <Instances placements={STRINGERS}>
        <boxGeometry args={[WALK.land - WALK.sea, 0.12, 0.14]} />
        <meshStandardMaterial
          color={ECOLOGY_COLORS.woodChengal}
          roughness={0.85}
        />
      </Instances>
      <Instances placements={PILES}>
        <boxGeometry args={[0.16, 1, 0.16]} />
        <meshStandardMaterial
          color={ECOLOGY_COLORS.woodChengal}
          roughness={0.9}
        />
      </Instances>
    </group>
  );
}

/** The gauge stands on the lane's seaward edge, between the boardwalk and the steps of the houses south of it. */
const GAUGE_Z = WALK.z - 1.8;

/** The gauge's staff in 10 cm bands from 0.5 m below today's high tide to 2.5 m above it, alternately pale and red. */
const BANDS = Arr.map(Arr.range(0, 29), (band) => ({
  band,
  placement: {
    position: [0.06, band * 0.1 + 0.05 - 0.5, 0],
  } satisfies Placement,
}));

/**
 * A tide gauge at the old high-tide line beside the boardwalk: a staff
 * painted in 10 cm bands, fixed to the seaward face of a timber pile.
 */
export function TideGauge() {
  return (
    <group position={[0, 0, GAUGE_Z]}>
      <mesh castShadow position={[0.2, 0.9, 0]} receiveShadow>
        <boxGeometry args={[0.22, 4.2, 0.22]} />
        <meshStandardMaterial
          color={ECOLOGY_COLORS.woodChengal}
          roughness={0.9}
        />
      </mesh>
      <Instances
        placements={Arr.map(
          Arr.filter(BANDS, ({ band }) => band % 2 === 0),
          ({ placement }) => placement
        )}
      >
        <boxGeometry args={[0.06, 0.1, 0.3]} />
        <meshStandardMaterial color={getColor("SLATE", 50)} roughness={0.5} />
      </Instances>
      <Instances
        placements={Arr.map(
          Arr.filter(BANDS, ({ band }) => band % 2 === 1),
          ({ placement }) => placement
        )}
      >
        <boxGeometry args={[0.06, 0.1, 0.3]} />
        <meshStandardMaterial color={REAGENT_COLORS.calx} roughness={0.5} />
      </Instances>
    </group>
  );
}
