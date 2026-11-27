import { useGLTF } from "@react-three/drei";
import {
  CCBY_LEOPARD_ASSET,
  CCBY_LEOPARD_CAT_ASSET,
  CCBY_MALAYAN_TAPIR_ASSET,
  CCBY_SUN_BEAR_ASSET,
  CCBY_TIGER_ASSET,
} from "@repo/design-system/components/contents/biology/assets";
import { buildStemGeometry } from "@repo/design-system/components/contents/biology/botanical";
import { leafBlade } from "@repo/design-system/components/contents/biology/flora";
import {
  LivingSpecimen,
  RiggedSpecimen,
} from "@repo/design-system/components/contents/biology/specimen";
import { BirdwingSpecimen } from "@repo/design-system/components/contents/biology/taxon/birdwing";
import { HornbillSpecimen } from "@repo/design-system/components/contents/biology/taxon/hornbill";
import type { TaxonOrganism } from "@repo/design-system/components/contents/biology/taxon/model";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const TILLERS = 7;
const BLADES = 18;
const PANICLES = 5;
const GRAINS = 26;

/**
 * Rice, Oryza sativa, as one tillering clump: jointed stems, long arching leaf
 * blades, and drooping panicles that carry every grain in its golden husk.
 */
function PadiSpecimen() {
  const { foliage, grains, stems } = useMemo(() => {
    const base = new Color(CLASSIFICATION_COLORS.padiLeaf);
    const tip = new Color(CLASSIFICATION_COLORS.leafFresh);
    const blades = Arr.makeBy(BLADES, (index) => {
      const heading = (index / BLADES) * Math.PI * 2 + (index % 3) * 0.21;
      const rise = 0.06 + (index % 5) * 0.035;
      return leafBlade(
        new Vector3(Math.cos(heading) * 0.02, rise, Math.sin(heading) * 0.02),
        heading,
        1.02 + (index % 4) * 0.09,
        0.34 + (index % 5) * 0.035,
        0.022,
        0.34 + (index % 3) * 0.08,
        10,
        base,
        tip
      );
    });
    const tillers = Arr.makeBy(TILLERS, (index) => {
      const heading = (index / TILLERS) * Math.PI * 2 + 0.4;
      const lean = 0.03 + (index % 3) * 0.02;
      return buildStemGeometry(
        [
          new Vector3(Math.cos(heading) * 0.012, 0, Math.sin(heading) * 0.012),
          new Vector3(Math.cos(heading) * lean, 0.16, Math.sin(heading) * lean),
          new Vector3(
            Math.cos(heading) * lean * 2.2,
            0.33,
            Math.sin(heading) * lean * 2.2
          ),
        ],
        0.0075,
        0.004,
        12,
        7,
        [{ bulge: 0.35, t: 0.45, width: 0.04 }]
      );
    });
    const husk = new SphereGeometry(0.0075, 8, 6).scale(1, 1.9, 0.8);
    const heads = Arr.makeBy(PANICLES, (index) => {
      const heading = (index / PANICLES) * Math.PI * 2 + 0.9;
      const dx = Math.cos(heading);
      const dz = Math.sin(heading);
      const axis = new CatmullRomCurve3([
        new Vector3(dx * 0.05, 0.3, dz * 0.05),
        new Vector3(dx * 0.09, 0.43, dz * 0.09),
        new Vector3(dx * 0.17, 0.47, dz * 0.17),
        new Vector3(dx * 0.25, 0.4, dz * 0.25),
        new Vector3(dx * 0.29, 0.31, dz * 0.29),
      ]);
      const seeds = Arr.makeBy(GRAINS, (grain) => {
        const along = 0.42 + (grain / (GRAINS - 1)) * 0.58;
        const point = axis.getPoint(along);
        const side = (grain % 2 === 0 ? 1 : -1) * (0.008 + (grain % 3) * 0.003);
        return husk
          .clone()
          .rotateZ((grain % 5) * 0.2 - 0.4)
          .translate(
            point.x - dz * side,
            point.y - 0.012 - (grain % 4) * 0.004,
            point.z + dx * side
          );
      });
      return {
        seeds,
        stalk: new TubeGeometry(axis, 20, 0.0032, 6, false),
      };
    });
    husk.dispose();
    const stalks = Arr.map(heads, (head) => head.stalk);
    const seedList = Arr.flatMap(heads, (head) => head.seeds);
    const merged = {
      foliage: mergeGeometries(blades),
      grains: mergeGeometries(seedList),
      stems: mergeGeometries([
        ...Arr.map(tillers, (tiller) => tiller.toNonIndexed()),
        ...Arr.map(stalks, (stalk) => stalk.toNonIndexed()),
      ]),
    };
    Arr.forEach([...blades, ...tillers, ...stalks, ...seedList], (part) =>
      part.dispose()
    );
    return merged;
  }, []);

  useEffect(
    () => () => {
      foliage.dispose();
      grains.dispose();
      stems.dispose();
    },
    [foliage, grains, stems]
  );

  return (
    <group scale={1.15}>
      <mesh castShadow position={[0, 0.012, 0]} receiveShadow>
        <cylinderGeometry args={[0.1, 0.11, 0.024, 28]} />
        <SurfaceMaterial
          bump={0.8}
          color={CLASSIFICATION_COLORS.gardenSoil}
          roughness={0.95}
          surface="concrete"
        />
      </mesh>
      <mesh castShadow geometry={foliage}>
        <meshPhysicalMaterial
          clearcoat={0.22}
          roughness={0.54}
          side={DoubleSide}
          vertexColors
        />
      </mesh>
      <mesh castShadow geometry={stems}>
        <meshPhysicalMaterial
          color={CLASSIFICATION_COLORS.padiStem}
          roughness={0.6}
        />
      </mesh>
      <mesh castShadow geometry={grains}>
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={CLASSIFICATION_COLORS.padiHusk}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

/** How tall each specimen stands on its tray, so its name can sit just above it. */
export const TAXON_SPECIMEN_HEIGHT: Readonly<Record<TaxonOrganism, number>> = {
  birdwing: 0.5,
  hornbill: 0.74,
  leopard: 0.46,
  leopardCat: 0.3,
  padi: 0.62,
  sunBear: 0.5,
  tapir: 0.52,
  tiger: 0.44,
};

/** High-detail wildlife and botanical specimen figurine for TaxonRankLab. */
export function TaxonSpecimenFigurine({
  organism,
}: {
  readonly organism: TaxonOrganism;
}) {
  return Match.value(organism).pipe(
    Match.when("tiger", () => (
      <RiggedSpecimen
        extent={0.9}
        heading={-Math.PI / 2}
        path={CCBY_TIGER_ASSET.path}
      />
    )),
    Match.when("leopard", () => (
      <LivingSpecimen
        extent={0.8}
        heading={Math.PI / 2}
        path={CCBY_LEOPARD_ASSET.path}
      />
    )),
    Match.when("leopardCat", () => (
      <LivingSpecimen
        extent={0.48}
        heading={Math.PI / 2}
        path={CCBY_LEOPARD_CAT_ASSET.path}
        phase={1.4}
      />
    )),
    Match.when("sunBear", () => (
      <LivingSpecimen
        extent={0.7}
        heading={Math.PI / 2}
        path={CCBY_SUN_BEAR_ASSET.path}
      />
    )),
    Match.when("tapir", () => (
      <LivingSpecimen
        extent={0.72}
        heading={Math.PI / 2}
        path={CCBY_MALAYAN_TAPIR_ASSET.path}
      />
    )),
    Match.when("hornbill", () => (
      <group scale={0.88}>
        <HornbillSpecimen />
      </group>
    )),
    Match.when("birdwing", () => <BirdwingSpecimen />),
    Match.when("padi", () => <PadiSpecimen />),
    Match.exhaustive
  );
}

useGLTF.preload(CCBY_TIGER_ASSET.path);
useGLTF.preload(CCBY_LEOPARD_ASSET.path);
