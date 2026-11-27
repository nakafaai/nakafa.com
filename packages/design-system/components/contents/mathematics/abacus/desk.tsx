import { RoundedBox } from "@react-three/drei";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  PLACES,
  placePower,
} from "@repo/design-system/components/contents/mathematics/abacus/place";
import {
  BOARD,
  BOARD_TOP,
  POT,
  SPIKE,
  spikeX,
  TIP,
  WASHER,
} from "@repo/design-system/components/contents/mathematics/abacus/rig";
import {
  beadProfile,
  looseBeads,
  potProfile,
} from "@repo/design-system/components/contents/mathematics/abacus/shape";
import { StudioTable } from "@repo/design-system/components/contents/mathematics/table";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { ABACUS_COLORS } from "@repo/design-system/lib/material/abacus";
import { Array as Arr } from "effect";
import { useLayoutEffect, useMemo } from "react";
import { LatheGeometry, Vector2 } from "three";

/**
 * Everything of the spike abacus that stands still on the desk: the desk
 * itself, the base with its washers, spikes and place plates, and the pot of
 * loose beads, with the lathe and lacquer the moving beads share.
 */

/** The lacquer of each place's beads, units first. */
export const PLACE_COLORS = [
  ABACUS_COLORS.beadUnits,
  ABACUS_COLORS.beadBase,
  ABACUS_COLORS.beadSquare,
  ABACUS_COLORS.beadCube,
] as const;

/** A brass place plate on the base's front: 54 mm wide, 29 mm tall, 1.2 mm thick. */
const CARD = { depth: 0.064, gap: 0.006, thickness: 0.0006 } as const;

/** How far in front of the base the middle of the place-value card lies. */
const CARD_Z = BOARD.depth / 2 + CARD.gap + CARD.depth / 2;

/** A lathe geometry from a profile of (radius, height) points. */
export function useLathe(
  profile: readonly (readonly [number, number])[],
  segments: number
) {
  const geometry = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(profile, ([radius, height]) => new Vector2(radius, height)),
        segments
      ),
    [profile, segments]
  );
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * A turned wooden bead: stain in the place's colour under clear lacquer, so
 * the grain of the wood still runs round it and the lacquer catches the light.
 */
export function BeadLacquer({ color }: { readonly color: string }) {
  return (
    <SurfaceMaterial
      bump={0.012}
      coat={0.9}
      color={color}
      repeat={[3, 0.6]}
      roughness={0.34}
      surface="wood"
    />
  );
}

/** The turned brass collar a rod stands in: a flared foot under a flat seat. */
const COLLAR = [
  [0.0001, 0],
  [WASHER.radius + 0.0022, 0],
  [WASHER.radius + 0.0022, 0.0004],
  [WASHER.radius + 0.0012, 0.0009],
  [WASHER.radius, 0.0011],
  [WASHER.radius, WASHER.height - 0.0002],
  [WASHER.radius - 0.0003, WASHER.height],
  [0.0001, WASHER.height],
] as const;

/** How far the plinth's foot stands out past the base all round, and how tall it is. */
const PLINTH = { height: 0.008, margin: 0.0035 } as const;

/** An oak school desk top, planked and oiled, running out past the frame at y = 0. */
export function Desk() {
  return <StudioTable color={ABACUS_COLORS.desk} />;
}

/**
 * The walnut base on its moulded plinth, with four polished brass rods in
 * turned brass collars, and the
 * printed place-value card lying in front of it: under each spike, the
 * place's power of the base and what that place is worth in base ten.
 */
export function Board({ base }: { readonly base: number }) {
  const quantity = useQuantity();
  const ink = useLabelInk();
  const collar = useLathe(COLLAR, 48);
  return (
    <group>
      <RoundedBox
        args={[
          BOARD.length + 2 * PLINTH.margin,
          PLINTH.height,
          BOARD.depth + 2 * PLINTH.margin,
        ]}
        castShadow
        position={[0, PLINTH.height / 2, 0]}
        radius={0.0022}
        receiveShadow
        smoothness={6}
      >
        <SurfaceMaterial
          bump={0.02}
          coat={0.35}
          color={ABACUS_COLORS.plinth}
          repeat={[1, 5]}
          roughness={0.42}
          surface="wood"
        />
      </RoundedBox>
      <RoundedBox
        args={[BOARD.length, BOARD.height - PLINTH.height, BOARD.depth]}
        castShadow
        position={[0, (BOARD.height + PLINTH.height) / 2, 0]}
        radius={0.005}
        receiveShadow
        smoothness={8}
      >
        <SurfaceMaterial
          bump={0.02}
          coat={0.45}
          color={ABACUS_COLORS.base}
          repeat={[0.5, 4]}
          roughness={0.38}
          surface="wood"
        />
      </RoundedBox>
      {Arr.map(Arr.range(0, PLACES - 1), (place) => (
        <group key={place} position={[spikeX(place), 0, 0]}>
          <mesh
            castShadow
            geometry={collar}
            position={[0, BOARD_TOP, 0]}
            receiveShadow
          >
            <MetalMaterial color={ABACUS_COLORS.brassShade} roughness={0.22} />
          </mesh>
          <mesh castShadow position={[0, BOARD_TOP + SPIKE.length / 2, 0]}>
            <cylinderGeometry
              args={[SPIKE.radius, SPIKE.radius, SPIKE.length, 40]}
            />
            <MetalMaterial color={ABACUS_COLORS.brass} roughness={0.14} />
          </mesh>
          <mesh castShadow position={[0, TIP, 0]}>
            <sphereGeometry
              args={[SPIKE.radius, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <MetalMaterial color={ABACUS_COLORS.brass} roughness={0.14} />
          </mesh>
          <ThreeLabel
            color={ink}
            fontSize="compact"
            position={[0, CARD.thickness, CARD_Z]}
          >
            <span className="flex flex-col items-center leading-tight">
              <InlineMath math={placePower(place, base)} />
              <InlineMath math={quantity(base ** place, "", 0)} />
            </span>
          </ThreeLabel>
        </group>
      ))}
      <PlaceCard />
    </group>
  );
}

/**
 * The place-value card: a sheet of thin white board lying on the desk in
 * front of the base, ruled into one column under each spike.
 */
function PlaceCard() {
  const width = SPIKE.gap * PLACES;
  return (
    <group position={[0, CARD.thickness / 2, CARD_Z]}>
      <mesh receiveShadow>
        <boxGeometry args={[width, CARD.thickness, CARD.depth]} />
        <meshStandardMaterial color={ABACUS_COLORS.card} roughness={0.85} />
      </mesh>
      {Arr.map(Arr.range(1, PLACES - 1), (rule) => (
        <mesh
          key={rule}
          position={[
            -width / 2 + rule * SPIKE.gap,
            CARD.thickness / 2 + 0.0001,
            0,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.0008, CARD.depth - 0.008]} />
          <meshStandardMaterial
            color={ABACUS_COLORS.cardRule}
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

/** The turned walnut pot beside the base, with loose beads lying on its floor. */
export function BeadPot() {
  const potGeometry = useLathe(useMemo(potProfile, []), 64);
  const beadGeometry = useLathe(useMemo(beadProfile, []), 32);
  return (
    <group>
      <mesh
        castShadow
        geometry={potGeometry}
        position={[POT.x, 0, 0]}
        receiveShadow
      >
        <SurfaceMaterial
          bump={0.02}
          coat={0.4}
          color={ABACUS_COLORS.pot}
          repeat={[4, 1]}
          roughness={0.4}
          surface="wood"
        />
      </mesh>
      {Arr.map(looseBeads(), (bead) => (
        <mesh
          castShadow
          geometry={beadGeometry}
          key={`${bead.x}-${bead.z}`}
          position={[bead.x, bead.y, bead.z]}
          receiveShadow
          rotation={[bead.tilt, 0, bead.tilt]}
        >
          <BeadLacquer
            color={PLACE_COLORS[bead.place] ?? ABACUS_COLORS.beadUnits}
          />
        </mesh>
      ))}
    </group>
  );
}
