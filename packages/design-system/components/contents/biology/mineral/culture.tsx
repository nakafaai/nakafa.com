import {
  createPrintedLabelTexture,
  LabeledVessel,
} from "@repo/design-system/components/contents/biology/fixtures";
import type { CultureSolution } from "@repo/design-system/components/contents/biology/mineral/model";
import { evaluateCultureGrowth } from "@repo/design-system/components/contents/biology/mineral/model";
import {
  BotanicalLeaf,
  FibrousRoots,
} from "@repo/design-system/components/contents/biology/seedling";
import { liquidMeniscus } from "@repo/design-system/components/contents/chemistry/glassware";
import { Turn } from "@repo/design-system/components/three/form/part";
import {
  GlassMaterial,
  LiquidMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, Vector3 } from "three";

const JAR_PROFILE = [
  [0, 0],
  [0.34, 0],
  [0.37, 0.025],
  [0.37, 0.62],
  [0.33, 0.7],
  [0.24, 0.73],
  [0.24, 0.8],
  [0.27, 0.825],
] as const;

const LIQUID_PROFILE = [
  [0, 0.02],
  [0.345, 0.02],
  ...liquidMeniscus(0.345, 0.56),
  [0, 0.56],
] as const;

const LEAF_SLOTS = [
  { id: "lf1", pitch: 0.22, ratio: 0.36, roll: 0.32, scale: 1.0, yaw: 0.2 },
  {
    id: "lf2",
    pitch: 0.2,
    ratio: 0.5,
    roll: 0.28,
    scale: 1.05,
    yaw: Math.PI - 0.25,
  },
  { id: "lf3", pitch: 0.26, ratio: 0.64, roll: 0.36, scale: 0.96, yaw: 1.1 },
  { id: "lf4", pitch: 0.28, ratio: 0.78, roll: 0.34, scale: 0.9, yaw: -1.1 },
  { id: "lf5", pitch: 0.3, ratio: 0.9, roll: 0.3, scale: 0.82, yaw: 2.3 },
  { id: "lf6", pitch: 0.32, ratio: 0.96, roll: 0.3, scale: 0.74, yaw: -2.4 },
] as const;

function solutionLabelSpec(solution: CultureSolution) {
  return Match.value(solution).pipe(
    Match.when("complete", () => ({
      accent: BOTANY_COLORS.healthyLeafDeep,
      badge: "KNOP COMPLETE",
      subtitle: "NPK + Mg2+ + Fe3+",
      title: "COMPLETE",
    })),
    Match.when("noNitrogen", () => ({
      accent: BOTANY_COLORS.agarAmber,
      badge: "DEFICIENT MEDIUM",
      subtitle: "OMITS NO3- / NH4+",
      title: "NO NO3-",
    })),
    Match.when("noPhosphorus", () => ({
      accent: BOTANY_COLORS.phosphorusPurple,
      badge: "DEFICIENT MEDIUM",
      subtitle: "OMITS PO4 3-",
      title: "NO PO4 3-",
    })),
    Match.when("noPotassium", () => ({
      accent: BOTANY_COLORS.necrosisEdge,
      badge: "DEFICIENT MEDIUM",
      subtitle: "OMITS K+",
      title: "NO K+",
    })),
    Match.when("noMagnesium", () => ({
      accent: BOTANY_COLORS.windGreen,
      badge: "DEFICIENT MEDIUM",
      subtitle: "OMITS Mg2+",
      title: "NO Mg2+",
    })),
    Match.exhaustive
  );
}

function leafAppearance(solution: CultureSolution) {
  return Match.value(solution).pipe(
    Match.when("complete", () => ({
      base: BOTANY_COLORS.healthyLeafDeep,
      edge: undefined,
      interveinal: BOTANY_COLORS.healthyLeaf,
      vein: BOTANY_COLORS.healthyLeafVein,
    })),
    Match.when("noNitrogen", () => ({
      base: BOTANY_COLORS.chlorosisYellow,
      edge: BOTANY_COLORS.agarAmber,
      interveinal: BOTANY_COLORS.chlorosisYellow,
      vein: BOTANY_COLORS.mgInterveinal,
    })),
    Match.when("noPhosphorus", () => ({
      base: BOTANY_COLORS.healthyLeafDeep,
      edge: BOTANY_COLORS.phosphorusPurple,
      interveinal: BOTANY_COLORS.phosphorusPurple,
      vein: BOTANY_COLORS.mgInterveinal,
    })),
    Match.when("noPotassium", () => ({
      base: BOTANY_COLORS.healthyLeaf,
      edge: BOTANY_COLORS.necrosisEdge,
      interveinal: BOTANY_COLORS.mgInterveinal,
      vein: BOTANY_COLORS.healthyLeafVein,
    })),
    Match.when("noMagnesium", () => ({
      base: BOTANY_COLORS.chlorosisYellow,
      edge: BOTANY_COLORS.mgInterveinal,
      interveinal: BOTANY_COLORS.chlorosisYellow,
      vein: BOTANY_COLORS.healthyLeafDeep,
    })),
    Match.exhaustive
  );
}

/** Lathed borosilicate Knop hydroponic culture jar with dark light-blocking foil sleeve, cotton stopper, printed formula label, and aeration tube. */
export function KnopCultureJar({
  solution,
}: {
  readonly solution: CultureSolution;
}) {
  const growth = evaluateCultureGrowth(solution);
  const labelSpec = solutionLabelSpec(solution);
  const leafStyle = leafAppearance(solution);

  const labelTex = useMemo(
    () =>
      createPrintedLabelTexture({
        accentColor: labelSpec.accent,
        badge: labelSpec.badge,
        subtitle: labelSpec.subtitle,
        title: labelSpec.title,
      }),
    [labelSpec.accent, labelSpec.badge, labelSpec.subtitle, labelSpec.title]
  );
  useEffect(() => () => labelTex?.dispose(), [labelTex]);

  const stemH = 0.56 * growth.stemHeight;
  const stemCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.72, 0),
        new Vector3(0.015, 0.72 + stemH * 0.45, 0.01),
        new Vector3(-0.012, 0.72 + stemH, 0),
      ]),
    [stemH]
  );

  const airTubeCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0.16, 0.14, 0.04),
        new Vector3(0.16, 0.84, 0.04),
        new Vector3(0.24, 0.96, 0.04),
        new Vector3(0.38, 0.96, 0.04),
      ]),
    []
  );

  return (
    <group>
      {/* Knop nutrient solution with concave meniscus */}
      <mesh>
        <Turn profile={LIQUID_PROFILE} />
        <LiquidMaterial color={BOTANY_COLORS.waterBlue} opacity={0.48} />
      </mesh>
      {/* Crystal-clear borosilicate jar */}
      <mesh castShadow renderOrder={2}>
        <Turn profile={JAR_PROFILE} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.28} />
      </mesh>
      {/* Dark foil sleeve wrapping back and sides to block algae (front cutaway exposes roots) */}
      <mesh position={[0, 0.32, 0]} rotation={[0, Math.PI * 0.4, 0]}>
        <cylinderGeometry
          args={[0.376, 0.376, 0.54, 32, 1, true, 0, Math.PI * 1.2]}
        />
        <meshStandardMaterial
          color={BOTANY_COLORS.foilDark}
          metalness={0.42}
          roughness={0.58}
          side={DoubleSide}
        />
      </mesh>
      {/* Printed formula label wrapped across front lower band */}
      {labelTex === null ? null : (
        <mesh position={[0, 0.19, 0]} rotation={[0, -Math.PI * 0.38, 0]}>
          <cylinderGeometry
            args={[0.379, 0.379, 0.2, 28, 1, true, 0, Math.PI * 0.76]}
          />
          <meshStandardMaterial
            map={labelTex}
            polygonOffset
            polygonOffsetFactor={-1}
            roughness={0.82}
          />
        </mesh>
      )}
      {/* Sculpted fibrous cotton-wool neck stopper */}
      <mesh castShadow position={[0, 0.77, 0]}>
        <cylinderGeometry args={[0.225, 0.205, 0.11, 24]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.cottonWool}
          roughness={0.95}
        />
      </mesh>
      {/* Bent borosilicate glass aeration tube */}
      <mesh castShadow renderOrder={3}>
        <tubeGeometry args={[airTubeCurve, 28, 0.018, 12, false]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.44} />
      </mesh>
      {/* Submerged branching fibrous roots */}
      <FibrousRoots
        color={BOTANY_COLORS.rootIvory}
        count={11}
        depth={0.42 * growth.rootLength}
        position={[0, 0.68, 0]}
        seed={14}
        spread={0.22}
      />
      {/* Living curved seedling stem */}
      <mesh castShadow>
        <tubeGeometry args={[stemCurve, 20, 0.022, 10, false]} />
        <meshStandardMaterial
          color={
            solution === "noNitrogen"
              ? BOTANY_COLORS.chlorosisYellow
              : BOTANY_COLORS.stemGreen
          }
          roughness={0.58}
        />
      </mesh>
      {/* Sculpted veined botanical leaves showing true deficiency symptoms */}
      {Arr.map(LEAF_SLOTS, (slot) => {
        const pt = stemCurve.getPoint(slot.ratio);
        return (
          <BotanicalLeaf
            baseColor={leafStyle.base}
            droop={0.22 + growth.chlorosisIndex * 0.14}
            edgeColor={leafStyle.edge}
            interveinalColor={leafStyle.interveinal}
            key={slot.id}
            length={0.4 * growth.leafScale * slot.scale}
            position={[pt.x, pt.y, pt.z]}
            rotation={[slot.roll, slot.yaw, slot.pitch]}
            veinColor={leafStyle.vein}
            width={0.64}
          />
        );
      })}
      {/* Labeled stock reagent jars flanking the culture bench */}
      <LabeledVessel
        accentColor={BOTANY_COLORS.healthyLeafDeep}
        badge="STOCK A"
        fillFraction={0.74}
        height={0.36}
        liquidColor={BOTANY_COLORS.cohesionCyan}
        position={[-0.94, 0, -0.18]}
        radius={0.12}
        subtitle="NO3- / K+ / PO4"
        title="NPK"
      />
      <LabeledVessel
        accentColor={BOTANY_COLORS.agarAmber}
        badge="STOCK B"
        fillFraction={0.62}
        height={0.34}
        liquidColor={BOTANY_COLORS.agarGlow}
        position={[0.94, 0, -0.18]}
        radius={0.115}
        subtitle="MgSO4 + FeCl3"
        title="Mg2+ Fe3+"
      />
    </group>
  );
}
