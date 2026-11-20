import type { Placement } from "@repo/design-system/components/contents/biology/instances";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import type {
  Crista,
  Point,
} from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  arch,
  attachment,
  CRISTAE,
  cristaPoint,
  FILLET,
  MEMBRANE,
  wallReach,
} from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  gridGeometry,
  stripGeometry,
  useMembraneMaterial,
} from "@repo/design-system/components/contents/biology/mitochondrion/membranes";
import {
  COMPLEX,
  COMPLEXES,
  SYNTHASE,
  SYNTHASES,
} from "@repo/design-system/components/contents/biology/mitochondrion/particles";
import { ORGANELLE_COLORS } from "@repo/design-system/lib/material/organelle";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { Color } from "three";

/** How finely a crista is drawn: steps around its half, across its face, and over its rim. */
const AROUND = 48;
const ACROSS = 16;
const OVER = 8;

/**
 * The shares from the axis to the rim that a crista's face is drawn at:
 * closer together towards the rim, where the face bends into the wall at a
 * junction, then finer still over the rim.
 */
const SHARES = Arr.appendAll(
  Arr.map(
    Arr.range(0, ACROSS),
    (step) => 0.75 * (1 - (1 - step / ACROSS) ** 2)
  ),
  Arr.map(Arr.range(1, OVER), (step) => 0.75 + (0.25 * step) / OVER)
);

/** The shares of the flat face alone, up to where the rim begins. */
const FLAT = Arr.take(SHARES, ACROSS + 1);

/** The angle round the axis of column `column` of a crista's face. */
function angleOf(column: number) {
  return Math.PI + (column / AROUND) * Math.PI;
}

/** The colour `color` as multipliers of the colour `base`, channel by channel. */
function ratioOf(color: string, base: string) {
  const top = new Color(color);
  const bottom = new Color(base);
  return new Color(top.r / bottom.r, top.g / bottom.g, top.b / bottom.b);
}

/**
 * How the crista's colour turns to the matrix wall's, so a face that bends
 * into the wall at a junction runs on into it as one membrane.
 */
const WALL_TINT = ratioOf(
  ORGANELLE_COLORS.matrixWall,
  ORGANELLE_COLORS.innerMembrane
);

/** How far into its bend towards the wall `point` of `crista` lies at `theta`: 0 on the flat face, 1 at the wall. */
function bendOf(crista: Crista, theta: number, point: Point) {
  const distance = Math.hypot(point[1] - arch(crista.x), point[2]);
  const into =
    (distance - wallReach(crista, theta) + 2 * FILLET) / (2 * FILLET);
  const share = Math.min(1, Math.max(0, into));
  return share * share * (3 - 2 * share);
}

/** One face of a crista as a smooth surface, turning to the wall's colour where it bends into it. */
function faceGeometry(crista: Crista, face: number) {
  const point = (row: number, column: number) =>
    cristaPoint(crista, angleOf(column), Arr.getUnsafe(SHARES, row), face);
  return gridGeometry(
    SHARES.length,
    AROUND + 1,
    point,
    face < 0,
    true,
    (row, column) =>
      new Color(1, 1, 1).lerp(
        WALL_TINT,
        bendOf(crista, angleOf(column), point(row, column))
      )
  );
}

/**
 * The cut face of a crista along the cut, from its bottom end to its top
 * end, `inset` in for the lumen. A free end rounds over its rim; an end that
 * folds out of the wall stops in the boundary membrane, where the cut through
 * the membrane takes over and the lumen opens into the intermembrane space.
 */
function capGeometry(crista: Crista, inset: number) {
  const shares = (theta: number) =>
    attachment(crista, theta) > 0.5 ? FLAT : SHARES;
  const down = Arr.map(
    Arr.reverse(shares(Math.PI)),
    (share) => [Math.PI, share] as const
  );
  const up = Arr.map(
    Arr.drop(shares(2 * Math.PI), 1),
    (share) => [2 * Math.PI, share] as const
  );
  return stripGeometry(
    Arr.map(
      Arr.appendAll(down, up),
      ([theta, share]) =>
        [
          cristaPoint(crista, theta, share, -1, inset),
          cristaPoint(crista, theta, share, 1, inset),
        ] as const
    )
  );
}

/** The geometry of one crista: both faces, the cut through the sac, and the lumen inside it. */
function useCrista(crista: Crista) {
  const geometry = useMemo(
    () => ({
      back: faceGeometry(crista, -1),
      cap: capGeometry(crista, 0),
      front: faceGeometry(crista, 1),
      lumen: capGeometry(crista, MEMBRANE),
    }),
    [crista]
  );
  useEffect(
    () => () => {
      for (const part of [
        geometry.back,
        geometry.cap,
        geometry.front,
        geometry.lumen,
      ]) {
        part.dispose();
      }
    },
    [geometry]
  );
  return geometry;
}

/**
 * One lamellar crista: a fold of the inner membrane, its faces meeting in a
 * rounded rim and bending into the boundary membrane at its junctions, cut
 * open where it crosses the cut so its two membranes and the lumen between
 * them show.
 */
function CristaSac({ crista }: { readonly crista: Crista }) {
  const geometry = useCrista(crista);
  const membrane = useMembraneMaterial(
    ORGANELLE_COLORS.innerMembrane,
    ORGANELLE_COLORS.innerSheen
  );
  const cut = useMembraneMaterial(
    ORGANELLE_COLORS.cutFace,
    ORGANELLE_COLORS.innerSheen,
    true
  );
  const lumen = useMembraneMaterial(
    ORGANELLE_COLORS.lumen,
    ORGANELLE_COLORS.innerSheen,
    true
  );
  return (
    <group>
      <mesh
        castShadow
        geometry={geometry.front}
        material={membrane}
        receiveShadow
      />
      <mesh
        castShadow
        geometry={geometry.back}
        material={membrane}
        receiveShadow
      />
      <mesh geometry={geometry.cap} material={cut} />
      <mesh
        geometry={geometry.lumen}
        material={lumen}
        position={[0, 0, 0.0004]}
      />
    </group>
  );
}

/**
 * The proteins of the cristae, each kind one instanced draw: the ATP
 * synthases on the rims, whose heads glow while they make ATP (`active`) and
 * go dark when there is no oxygen to run the chain, and the respiratory chain
 * complexes on the faces.
 */
export function CristaProteins({ active }: { readonly active: boolean }) {
  const glow = useMemo(
    () =>
      new Color(ORGANELLE_COLORS.synthase).multiplyScalar(active ? 0.45 : 0),
    [active]
  );
  const heads = Arr.map(
    SYNTHASES,
    ({ head }): Placement => ({ position: head })
  );
  const stalks = Arr.map(
    SYNTHASES,
    ({ foot, up }): Placement => ({
      position: shift(foot, up, SYNTHASE.stalk / 2),
      up,
    })
  );
  const complexes = Arr.map(
    COMPLEXES,
    ({ face, position, spin }): Placement => ({
      position,
      scale: [COMPLEX.width, COMPLEX.lift, COMPLEX.width * 0.7],
      spin,
      up: [face, 0, 0],
    })
  );
  return (
    <group>
      <Instances placements={heads}>
        <sphereGeometry args={[SYNTHASE.head, 12, 10]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          clearcoatRoughness={0.35}
          color={ORGANELLE_COLORS.synthase}
          emissive={glow}
          roughness={0.4}
        />
      </Instances>
      <Instances placements={stalks}>
        <cylinderGeometry
          args={[SYNTHASE.head * 0.32, SYNTHASE.head * 0.4, SYNTHASE.stalk, 8]}
        />
        <meshPhysicalMaterial
          color={ORGANELLE_COLORS.synthase}
          roughness={0.5}
        />
      </Instances>
      <Instances placements={complexes}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={ORGANELLE_COLORS.complex}
          roughness={0.45}
        />
      </Instances>
    </group>
  );
}

/** `point` moved `length` along `direction`. */
function shift(point: Point, direction: Point, length: number): Point {
  return [
    point[0] + direction[0] * length,
    point[1] + direction[1] * length,
    point[2] + direction[2] * length,
  ];
}

/** The cristae of the organelle, each a fold of its inner membrane. */
export function Cristae() {
  return (
    <group>
      {Arr.map(CRISTAE, (crista) => (
        <CristaSac crista={crista} key={crista.x} />
      ))}
    </group>
  );
}
