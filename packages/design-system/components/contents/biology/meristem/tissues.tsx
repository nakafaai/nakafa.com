import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { Cells } from "@repo/design-system/components/three/flora/cells";
import { Disc } from "@repo/design-system/components/three/flora/disc";
import {
  joinMeshes,
  limbMesh,
  smoothPath,
} from "@repo/design-system/components/three/flora/limb";
import { solidOf } from "@repo/design-system/components/three/flora/solid";
import type {
  Section,
  ZONES,
} from "@repo/design-system/components/three/flora/tissue";
import {
  sectionCells,
  sectionWidth,
} from "@repo/design-system/components/three/flora/tissue";
import { Turn } from "@repo/design-system/components/three/form/part";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, TubeGeometry, Vector3 } from "three";

/** How far the cells stand out of the face an organ is cut along. */
const DEPTH = 0.034;

/** A root tip cut along its length: cap, dividing cells, growing cells, grown cells. */
const ROOT: Section = {
  apex: 0.4,
  cap: 0.15,
  division: 0.56,
  elongation: 0.94,
  files: 14,
  length: 1.42,
  radius: 0.26,
  seed: 7,
  short: 0.036,
  skew: 0,
  tall: 0.17,
};

/** A shoot tip cut along its length: a dome of dividing cells with no cap over it. */
const SHOOT: Section = {
  apex: 0.3,
  cap: 0,
  division: 0.46,
  elongation: 0.84,
  files: 14,
  length: 1.32,
  radius: 0.26,
  seed: 11,
  short: 0.034,
  skew: 0,
  tall: 0.14,
};

const ROOT_TONES = [
  FLORA_COLORS.rootCap,
  FLORA_COLORS.rootDivision,
  FLORA_COLORS.rootGrowing,
  FLORA_COLORS.rootMature,
] as const;

const SHOOT_TONES = [
  FLORA_COLORS.shootDivision,
  FLORA_COLORS.shootDivision,
  FLORA_COLORS.shootGrowing,
  FLORA_COLORS.shootMature,
] as const;

/** The outline of a cut organ from its tip to its far end, for the skin turned around its axis. */
function outline(section: Section) {
  return Arr.makeBy(48, (step) => {
    const along = (step / 47) ** 1.6 * section.length;
    return [sectionWidth(section, along), along] as const;
  });
}

/** The half of an organ's skin that is left behind the cut, turned from its outline. */
function Skin({
  color,
  section,
}: {
  readonly color: string;
  readonly section: Section;
}) {
  const profile = useMemo(() => outline(section), [section]);
  return (
    <mesh castShadow receiveShadow>
      <Turn arc={[Math.PI / 2, Math.PI]} profile={profile} />
      <SurfaceMaterial
        bump={0.5}
        color={color}
        repeat={[6, 8]}
        roughness={0.62}
        side={DoubleSide}
        surface="tissue"
      />
    </mesh>
  );
}

/** The root hairs of the grown zone: each one cell of the skin, drawn out into the soil, longer the older it is. */
function useRootHairs() {
  const hairs = useMemo(
    () =>
      solidOf(
        joinMeshes(
          Arr.makeBy(90, (hair) => {
            const along = ROOT.elongation + 0.03 + chanceAt(hair, 1, 3) * 0.42;
            const turn = Math.PI * (0.5 + chanceAt(hair, 2, 3));
            const age = (along - ROOT.elongation) / 0.45;
            const reach =
              (0.07 + 0.34 * age) * (0.55 + 0.9 * chanceAt(hair, 3, 3));
            const out = [Math.sin(turn), Math.cos(turn)] as const;
            const path = smoothPath(
              Arr.makeBy(5, (knot) => {
                const far = ROOT.radius - 0.004 + (reach * knot) / 4;
                const wave = (chanceAt(hair, 10 + knot, 3) - 0.5) * 0.05 * knot;
                return [
                  out[0] * far - out[1] * wave,
                  along + wave * 0.7 - 0.012 * knot * knot * age,
                  out[1] * far + out[0] * wave,
                ] as const;
              }),
              10
            );
            return limbMesh({
              arc: 1,
              base: 0.0075,
              flare: 0.5,
              furrow: 0,
              path,
              seed: hair,
              sides: 6,
              tip: 0.0035,
            });
          })
        )
      ),
    []
  );
  useEffect(() => () => hairs.dispose(), [hairs]);
  return hairs;
}

/** A water vessel of the root's core seen through the cut: a dead, hollow tube held open by a spiral of lignin. */
function Vessel({
  from,
  turns,
  x,
}: {
  readonly from: number;
  readonly turns: number;
  readonly x: number;
}) {
  const { spiral, tube } = useMemo(() => {
    const rise = ROOT.length - from;
    const coil = new CatmullRomCurve3(
      Arr.makeBy(turns * 12 + 1, (step) => {
        const angle = (step / 12) * 2 * Math.PI;
        return new Vector3(
          Math.cos(angle) * 0.024,
          from + (rise * step) / (turns * 12),
          Math.sin(angle) * 0.024
        );
      })
    );
    return {
      spiral: new TubeGeometry(coil, turns * 36, 0.0055, 6, false),
      tube: solidOf(
        limbMesh({
          arc: 1,
          base: 0.023,
          flare: 0,
          furrow: 0,
          path: [
            [0, from, 0],
            [0, from + rise / 2, 0],
            [0, ROOT.length, 0],
          ],
          seed: turns,
          sides: 16,
          tip: 0.023,
        })
      ),
    };
  }, [from, turns]);
  useEffect(
    () => () => {
      spiral.dispose();
      tube.dispose();
    },
    [spiral, tube]
  );

  return (
    <group position={[x, 0, DEPTH + 0.012]}>
      <mesh geometry={tube}>
        <Matter color={FLORA_COLORS.vesselWall} of="lacquer" opacity={0.72} />
      </mesh>
      <mesh castShadow geometry={spiral}>
        <SurfaceMaterial
          bump={0.4}
          color={FLORA_COLORS.ligninRing}
          repeat={[1, 40]}
          roughness={0.6}
          surface="wood"
        />
      </mesh>
    </group>
  );
}

/**
 * A root tip cut along its length, as a section under the microscope shows
 * it: the cap of loose cells over the tip, the dense dividing cells behind it
 * (some caught with their chromosomes in a plate), the cells that lengthen as
 * their vacuoles swell, and the grown zone with its vessels and root hairs.
 */
export function RootApexCutaway({
  lit,
}: {
  readonly lit?: keyof typeof ZONES | undefined;
}) {
  const cells = useMemo(() => sectionCells(ROOT), []);
  const hairs = useRootHairs();

  return (
    <group>
      <Skin color={FLORA_COLORS.rootSkin} section={ROOT} />
      <Cells cells={cells} depth={DEPTH} lit={lit} tones={ROOT_TONES} />
      <Vessel from={0.78} turns={9} x={-0.028} />
      <Vessel from={0.98} turns={16} x={0.028} />
      <mesh castShadow geometry={hairs}>
        <SurfaceMaterial
          bump={0.2}
          coat={0.6}
          color={FLORA_COLORS.rootHair}
          repeat={[1, 4]}
          roughness={0.35}
          surface="tissue"
          wet
        />
      </mesh>
    </group>
  );
}

/** The young leaves that arch over a shoot tip, the youngest nearest the dome. */
const PRIMORDIA = [
  { base: 0.085, foot: 0.5, reach: 0.45, rise: 0.56, side: -1 },
  { base: 0.085, foot: 0.54, reach: 0.4, rise: 0.62, side: 1 },
  { base: 0.05, foot: 0.24, reach: 0.3, rise: 0.25, side: -1 },
  { base: 0.045, foot: 0.18, reach: 0.25, rise: 0.19, side: 1 },
] as const;

/** The leaf primordia of a shoot tip as one solid: horns that rise from the flank and curve in over the dome. */
function usePrimordia() {
  const horns = useMemo(
    () =>
      solidOf(
        joinMeshes(
          Arr.map(PRIMORDIA, (horn, index) =>
            limbMesh({
              arc: 1,
              base: horn.base,
              flare: 0.25,
              furrow: 0.05,
              path: smoothPath(
                [
                  [
                    horn.side * (sectionWidth(SHOOT, horn.foot) - 0.02),
                    horn.foot,
                    -0.03,
                  ],
                  [
                    horn.side * (sectionWidth(SHOOT, horn.foot) + 0.04),
                    horn.foot - horn.rise * 0.45,
                    -0.03,
                  ],
                  [
                    horn.side * (sectionWidth(SHOOT, horn.foot) - 0.03),
                    horn.foot - horn.rise * 0.85,
                    -0.03,
                  ],
                  [
                    horn.side * sectionWidth(SHOOT, horn.foot) * horn.reach,
                    horn.foot - horn.rise * 1.06,
                    -0.03,
                  ],
                ],
                18
              ),
              seed: index,
              sides: 16,
              tip: 0.022,
            })
          )
        )
      ),
    []
  );
  useEffect(() => () => horns.dispose(), [horns]);
  return horns;
}

/**
 * A shoot tip cut along its length: the dome of small dividing cells at the
 * very top, the leaf primordia it has just made arching over it, and below
 * it the cells that lengthen and push the tip upward.
 */
export function ShootApexCutaway({
  lit,
}: {
  readonly lit?: keyof typeof ZONES | undefined;
}) {
  const cells = useMemo(() => sectionCells(SHOOT), []);
  const horns = usePrimordia();

  return (
    <group position={[0, SHOOT.length, 0]} rotation={[0, 0, Math.PI]}>
      <Skin color={FLORA_COLORS.shootSkin} section={SHOOT} />
      <Cells cells={cells} depth={DEPTH} lit={lit} tones={SHOOT_TONES} />
      <mesh castShadow geometry={horns} receiveShadow scale={[1, 1, 0.55]}>
        <SurfaceMaterial
          bump={0.5}
          color={FLORA_COLORS.primordium}
          repeat={[2, 6]}
          roughness={0.6}
          surface="leaf"
        />
      </mesh>
    </group>
  );
}

/**
 * A length of woody stem sawn across: furrowed bark around it, and on its
 * face the rings its vascular cambium laid down, one a year, pale spring wood
 * darkening into a dense band, with rays running out from the pith, the wet
 * line of the cambium, the inner bark and the cork.
 */
export function SecondaryWoodCrossSection({
  outerRadius,
  ringCount,
  xylemRadius,
}: {
  readonly outerRadius: number;
  readonly ringCount: number;
  readonly xylemRadius: number;
}) {
  const bark = useMemo(
    () =>
      solidOf(
        limbMesh({
          arc: 1,
          base: outerRadius,
          flare: 0.04,
          furrow: 0.09,
          path: Arr.makeBy(9, (step) => [0, (step / 8) * 0.56, 0] as const),
          seed: 3,
          sides: 72,
          tip: outerRadius * 0.97,
        })
      ),
    [outerRadius]
  );
  useEffect(() => () => bark.dispose(), [bark]);

  return (
    <group>
      <mesh castShadow geometry={bark} receiveShadow>
        <SurfaceMaterial
          bump={1}
          color={FLORA_COLORS.barkGrey}
          repeat={[6, 1]}
          roughness={0.95}
          surface="bark"
        />
      </mesh>
      <group position={[0, 0.556, 0]}>
        <Disc
          radius={outerRadius * 0.985}
          rings={ringCount}
          wood={xylemRadius / outerRadius}
        />
      </group>
    </group>
  );
}
