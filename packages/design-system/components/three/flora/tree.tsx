import { Foliage } from "@repo/design-system/components/three/flora/foliage";
import type { HABITS } from "@repo/design-system/components/three/flora/habit";
import {
  growHabit,
  HABITS as SPECIES,
  stageHabit,
} from "@repo/design-system/components/three/flora/habit";
import {
  joinMeshes,
  limbMesh,
} from "@repo/design-system/components/three/flora/limb";
import { solidOf } from "@repo/design-system/components/three/flora/solid";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";

/** The leaf each woody plant bears and the colours of its wood and leaves. */
const DRESS = {
  biennial: {
    bark: FLORA_COLORS.stemGreen,
    blade: {
      arch: 0.3,
      columns: 8,
      fold: 0.26,
      length: 1,
      outline: "ovate",
      relief: 0.03,
      rows: 14,
      teeth: 14,
      veins: 8,
      wave: 0.16,
      width: 0.62,
    },
    deep: FLORA_COLORS.leafDeep,
    skin: "leaf",
    sun: FLORA_COLORS.leafSun,
  },
  broadleaf: {
    bark: FLORA_COLORS.barkGrey,
    blade: {
      arch: 0.22,
      columns: 6,
      fold: 0.32,
      length: 1,
      outline: "ovate",
      relief: 0.022,
      rows: 10,
      teeth: 9,
      veins: 7,
      wave: 0.12,
      width: 0.56,
    },
    deep: FLORA_COLORS.leafDeep,
    skin: "bark",
    sun: FLORA_COLORS.leafSun,
  },
  conifer: {
    bark: FLORA_COLORS.barkPine,
    blade: {
      arch: 0.1,
      columns: 2,
      fold: 0.5,
      length: 1,
      outline: "linear",
      relief: 0,
      rows: 4,
      teeth: 0,
      veins: 1,
      wave: 0,
      width: 0.07,
    },
    deep: FLORA_COLORS.needleDeep,
    skin: "bark",
    sun: FLORA_COLORS.needleSun,
  },
  herb: {
    bark: FLORA_COLORS.stemGreen,
    blade: {
      arch: 0.3,
      columns: 8,
      fold: 0.26,
      length: 1,
      outline: "ovate",
      relief: 0.03,
      rows: 14,
      teeth: 14,
      veins: 8,
      wave: 0.16,
      width: 0.62,
    },
    deep: FLORA_COLORS.leafDeep,
    skin: "leaf",
    sun: FLORA_COLORS.leafSun,
  },
  sapling: {
    bark: FLORA_COLORS.barkGrey,
    blade: {
      arch: 0.25,
      columns: 6,
      fold: 0.3,
      length: 1,
      outline: "ovate",
      relief: 0.022,
      rows: 10,
      teeth: 9,
      veins: 7,
      wave: 0.1,
      width: 0.54,
    },
    deep: FLORA_COLORS.leafDeep,
    skin: "bark",
    sun: FLORA_COLORS.leafYoung,
  },
  shrub: {
    bark: FLORA_COLORS.barkGrey,
    blade: {
      arch: 0.18,
      columns: 4,
      fold: 0.35,
      length: 1,
      outline: "elliptic",
      relief: 0.01,
      rows: 8,
      teeth: 0,
      veins: 6,
      wave: 0.06,
      width: 0.46,
    },
    deep: FLORA_COLORS.shrubDeep,
    skin: "bark",
    sun: FLORA_COLORS.shrubSun,
  },
} as const;

/**
 * A plant grown from its habit: a tapered stem with a swollen base, branches
 * that leave it at collars and fork by the golden angle, bark or green skin
 * in relief, and veined leaves that stir in the wind. Name the plant; the
 * same `seed` always grows the same individual. Its children are drawn at its
 * growing tip, where a flower opens.
 *
 * @param habit - Which plant this is
 * @param seed - Which individual of it
 * @param stage - How far it has grown, from a seedling (0) to full grown (1)
 * @param aged - Whether its leaves have yellowed at the end of its life
 * @param children - What it bears at its growing tip
 */
export function Tree({
  aged = false,
  children,
  habit,
  seed = 1,
  stage = 1,
}: {
  readonly aged?: boolean;
  readonly children?: ReactNode;
  readonly habit: keyof typeof HABITS;
  readonly seed?: number;
  readonly stage?: number;
}) {
  const dress = DRESS[habit];
  const { leaves, tip, wood } = useMemo(() => {
    const growth = growHabit(stageHabit(SPECIES[habit], stage), seed);
    return {
      leaves: growth.leaves,
      tip: growth.tip,
      wood: solidOf(joinMeshes(Arr.map(growth.limbs, limbMesh))),
    };
  }, [habit, seed, stage]);
  useEffect(() => () => wood.dispose(), [wood]);

  return (
    <group>
      <mesh castShadow geometry={wood} receiveShadow>
        <SurfaceMaterial
          bump={dress.skin === "bark" ? 1 : 0.4}
          color={dress.bark}
          repeat={[2, 1]}
          roughness={dress.skin === "bark" ? 0.95 : 0.55}
          surface={dress.skin}
        />
      </mesh>
      <Foliage
        blade={dress.blade}
        deep={aged ? FLORA_COLORS.leafAgedDeep : dress.deep}
        leaves={leaves}
        sun={aged ? FLORA_COLORS.leafAgedSun : dress.sun}
      />
      <group position={tip}>{children}</group>
    </group>
  );
}
