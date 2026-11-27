import { useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  TaxonOrganism,
  TaxonRank,
} from "@repo/design-system/components/contents/biology/taxon/model";
import {
  compareTaxons,
  lineageOf,
  TAXON_RANKS,
} from "@repo/design-system/components/contents/biology/taxon/model";
import {
  TAXON_SPECIMEN_HEIGHT,
  TaxonSpecimenFigurine,
} from "@repo/design-system/components/contents/biology/taxon/specimens";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr } from "effect";

function TaxonCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 4.3, 6.5] : [0, 2.85, 4.45]}
      cameraTarget={[0, 0.3, 0.05]}
      fov={38}
      maxDistance={8}
      minDistance={1.8}
    />
  );
}

/** Computes exact terrace surface height Y at (x, z) so figurines always rest flush on solid ground. */
function terraceTopAt(x: number, z: number) {
  let highest = 0.066;
  for (let index = 0; index < TAXON_RANKS.length; index += 1) {
    const halfW = (3.6 - index * 0.44) / 2;
    const halfD = (2.7 - index * 0.33) / 2;
    if (Math.abs(x) <= halfW && Math.abs(z) <= halfD) {
      highest = index * 0.068 + 0.066;
    }
  }
  return highest;
}

/** One stepped architectural taxonomic rank terrace with staggered non-overlapping rim label. */
function TaxonRankTier({
  index,
  ink,
  label,
  shared,
}: {
  readonly index: number;
  readonly ink: string;
  readonly label: string;
  readonly shared: boolean;
}) {
  const width = 3.6 - index * 0.44;
  const depth = 2.7 - index * 0.33;
  const y = index * 0.068;
  const side = index % 2 === 0 ? -1 : 1;
  const labelX = index === 6 ? 0 : side * Math.max(0.42, width / 2 - 0.36);
  const labelZ =
    index === 6
      ? -depth / 2 - 0.16
      : depth / 2 - 0.1 - Math.floor(index / 2) * 0.14;

  return (
    <group position={[0, y, 0]}>
      <mesh castShadow position={[0, 0.032, 0]} receiveShadow>
        <boxGeometry args={[width, 0.064, depth]} />
        <meshPhysicalMaterial
          clearcoat={shared ? 0.45 : 0.14}
          color={
            shared
              ? CLASSIFICATION_COLORS.rankShared
              : CLASSIFICATION_COLORS.rankNeutral
          }
          emissive={
            shared
              ? CLASSIFICATION_COLORS.rankSharedGlow
              : CLASSIFICATION_COLORS.rankFloor
          }
          emissiveIntensity={shared ? 0.22 : 0}
          metalness={shared ? 0.18 : 0.04}
          roughness={shared ? 0.4 : 0.62}
        />
      </mesh>
      <mesh position={[0, 0.056, 0]} receiveShadow>
        <boxGeometry args={[width - 0.11, 0.02, depth - 0.11]} />
        <SurfaceMaterial
          bump={0.22}
          color={
            shared
              ? CLASSIFICATION_COLORS.rankFloor
              : CLASSIFICATION_COLORS.terraceStone
          }
          roughness={0.78}
          surface="concrete"
        />
      </mesh>
      <ThreeLabel
        color={shared ? CLASSIFICATION_COLORS.rankShared : ink}
        fontSize="compact"
        position={[labelX, 0.088, labelZ]}
      >
        <span className="font-medium">{label}</span>
      </ThreeLabel>
    </group>
  );
}

export function TaxonRankScene({
  first,
  organismNames,
  rankNames,
  second,
}: {
  readonly first: TaxonOrganism;
  readonly organismNames: Readonly<Partial<Record<TaxonOrganism, string>>>;
  readonly rankNames: Readonly<Record<TaxonRank, string>>;
  readonly second: TaxonOrganism;
}) {
  const ink = useLabelInk();
  const comparison = compareTaxons(first, second);
  const leftLineage = lineageOf(first);
  const sharedDepth = comparison.count;

  const nextStepWidth =
    sharedDepth < TAXON_RANKS.length ? 3.6 - sharedDepth * 0.44 : 0.6;
  const perchX =
    sharedDepth >= 6 ? 0.66 : Math.min(1.5, nextStepWidth / 2 + 0.16);
  const perchZ = sharedDepth >= 5 ? 0.12 : 0.24;
  const perchY = terraceTopAt(perchX, perchZ);
  const labelSpreadX = sharedDepth >= 6 ? 0.16 : 0;
  // On a phone a long name runs off the card, so each name starts at its own
  // edge of the terrace and stands a line above the rank labels.
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  const labelEdge = narrow ? 0.5 : 0;
  const labelLift = narrow ? 0.66 : 0.12;

  return (
    <group>
      <TaxonCamera />
      {Arr.map(TAXON_RANKS, (rank, index) => {
        const shared = index < sharedDepth;
        const label = shared
          ? `${rankNames[rank]}: ${leftLineage[rank]}`
          : rankNames[rank];
        return (
          <TaxonRankTier
            index={index}
            ink={ink}
            key={rank}
            label={label}
            shared={shared}
          />
        );
      })}

      <group position={[-perchX, perchY, perchZ]} rotation={[0, 0.5, 0]}>
        <TaxonSpecimenFigurine organism={first} />
      </group>
      <ThreeLabel
        anchorX={narrow ? "left" : "center"}
        color={ink}
        fontSize="compact"
        position={[
          -perchX - labelSpreadX - labelEdge,
          perchY + TAXON_SPECIMEN_HEIGHT[first] + labelLift,
          perchZ,
        ]}
      >
        <span className="font-medium">{organismNames[first] ?? first}</span>
      </ThreeLabel>

      <group
        position={[perchX, perchY, perchZ]}
        rotation={[0, -Math.PI - 0.5, 0]}
      >
        <TaxonSpecimenFigurine organism={second} />
      </group>
      <ThreeLabel
        anchorX={narrow ? "right" : "center"}
        color={ink}
        fontSize="compact"
        position={[
          perchX + labelSpreadX + labelEdge,
          perchY + TAXON_SPECIMEN_HEIGHT[second] + labelLift,
          perchZ,
        ]}
      >
        <span className="font-medium">{organismNames[second] ?? second}</span>
      </ThreeLabel>
    </group>
  );
}
