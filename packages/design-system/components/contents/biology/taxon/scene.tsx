import { useThree } from "@react-three/fiber";
import type {
  TaxonOrganism,
  TaxonRank,
} from "@repo/design-system/components/contents/biology/taxon/model";
import {
  compareTaxons,
  lineageOf,
  TAXON_RANKS,
} from "@repo/design-system/components/contents/biology/taxon/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr, Match } from "effect";

function OrganismFigurine({ organism }: { readonly organism: TaxonOrganism }) {
  return Match.value(organism).pipe(
    Match.when("tiger", () => (
      <group>
        <mesh castShadow position={[0, 0.12, 0]} scale={[1.35, 0.85, 0.7]}>
          <sphereGeometry args={[0.11, 16, 12]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.tigerOrange}
            roughness={0.62}
          />
        </mesh>
        <mesh castShadow position={[0.14, 0.18, 0]}>
          <sphereGeometry args={[0.075, 14, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.tigerOrange}
            roughness={0.62}
          />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <torusGeometry args={[0.088, 0.012, 6, 16]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.tigerStripe}
            roughness={0.7}
          />
        </mesh>
      </group>
    )),
    Match.when("leopard", () => (
      <group>
        <mesh castShadow position={[0, 0.12, 0]} scale={[1.3, 0.8, 0.65]}>
          <sphereGeometry args={[0.1, 16, 12]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leopardGold}
            roughness={0.6}
          />
        </mesh>
        <mesh castShadow position={[0.13, 0.17, 0]}>
          <sphereGeometry args={[0.068, 14, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leopardGold}
            roughness={0.6}
          />
        </mesh>
      </group>
    )),
    Match.when("leopardCat", () => (
      <group scale={[0.82, 0.82, 0.82]}>
        <mesh castShadow position={[0, 0.12, 0]} scale={[1.25, 0.8, 0.65]}>
          <sphereGeometry args={[0.1, 16, 12]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leopardGold}
            roughness={0.62}
          />
        </mesh>
        <mesh castShadow position={[0.12, 0.17, 0]}>
          <sphereGeometry args={[0.066, 14, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leopardGold}
            roughness={0.62}
          />
        </mesh>
      </group>
    )),
    Match.when("sunBear", () => (
      <group>
        <mesh castShadow position={[0, 0.13, 0]} scale={[1.15, 0.95, 0.85]}>
          <sphereGeometry args={[0.12, 16, 12]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.bearDark}
            roughness={0.78}
          />
        </mesh>
        <mesh castShadow position={[0.11, 0.21, 0]}>
          <sphereGeometry args={[0.072, 14, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.bearDark}
            roughness={0.78}
          />
        </mesh>
        <mesh position={[0.12, 0.15, 0.05]}>
          <torusGeometry args={[0.032, 0.01, 6, 12, Math.PI]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.bearChest}
            roughness={0.65}
          />
        </mesh>
      </group>
    )),
    Match.when("tapir", () => (
      <group>
        <mesh castShadow position={[0, 0.13, 0]} scale={[1.35, 0.9, 0.78]}>
          <sphereGeometry args={[0.12, 16, 12]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.bearDark}
            roughness={0.72}
          />
        </mesh>
        <mesh position={[-0.02, 0.13, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.12, 16]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.tapirLight}
            roughness={0.72}
          />
        </mesh>
      </group>
    )),
    Match.when("hornbill", () => (
      <group>
        <mesh castShadow position={[0, 0.14, 0]} scale={[0.85, 1.15, 0.7]}>
          <sphereGeometry args={[0.1, 14, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.bearDark}
            roughness={0.65}
          />
        </mesh>
        <mesh
          castShadow
          position={[0.11, 0.21, 0]}
          rotation={[0, 0, -Math.PI / 2]}
        >
          <coneGeometry args={[0.045, 0.18, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.hornbillBeak}
            roughness={0.45}
          />
        </mesh>
      </group>
    )),
    Match.when("birdwing", () => (
      <group position={[0, 0.14, 0]}>
        <mesh
          castShadow
          position={[-0.09, 0.02, 0]}
          rotation={[0.2, 0, 0.35]}
          scale={[1.3, 0.08, 0.9]}
        >
          <sphereGeometry args={[0.09, 12, 8]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.birdwingGreen}
            roughness={0.45}
          />
        </mesh>
        <mesh
          castShadow
          position={[0.09, 0.02, 0]}
          rotation={[0.2, 0, -0.35]}
          scale={[1.3, 0.08, 0.9]}
        >
          <sphereGeometry args={[0.09, 12, 8]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.birdwingGreen}
            roughness={0.45}
          />
        </mesh>
      </group>
    )),
    Match.when("padi", () => (
      <group>
        <mesh castShadow position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.016, 0.02, 0.28, 8]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leafBright}
            roughness={0.62}
          />
        </mesh>
        <mesh castShadow position={[0.04, 0.27, 0]} rotation={[0, 0, -0.5]}>
          <capsuleGeometry args={[0.024, 0.1, 6, 8]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.padiGold}
            roughness={0.5}
          />
        </mesh>
      </group>
    )),
    Match.exhaustive
  );
}

function TaxonCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 3.05, 4.4] : [0, 2.45, 3.5]}
      cameraTarget={[0, 0.22, 0]}
      fov={38}
      maxDistance={7}
      minDistance={1.6}
    />
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
  const comparison = compareTaxons(first, second);
  const leftLineage = lineageOf(first);
  const sharedDepth = comparison.count;
  const perchRadius =
    sharedDepth === 0 ? 1.85 : 1.75 - (sharedDepth - 1) * 0.22;
  const perchY = sharedDepth === 0 ? 0.04 : sharedDepth * 0.065;

  return (
    <group>
      <TaxonCamera />
      {Arr.map(TAXON_RANKS, (rank, index) => {
        const shared = index < sharedDepth;
        const width = 3.5 - index * 0.44;
        const depth = 2.6 - index * 0.32;
        const y = index * 0.065;
        return (
          <group key={rank} position={[0, y, 0]}>
            <mesh castShadow position={[0, 0.03, 0]} receiveShadow>
              <boxGeometry args={[width, 0.06, depth]} />
              <meshStandardMaterial
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
                emissiveIntensity={shared ? 0.28 : 0}
                roughness={0.52}
              />
            </mesh>
            <mesh position={[0, 0.052, 0]} receiveShadow>
              <boxGeometry args={[width - 0.1, 0.02, depth - 0.1]} />
              <meshStandardMaterial
                color={CLASSIFICATION_COLORS.rankFloor}
                roughness={0.78}
              />
            </mesh>
            <ThreeLabel
              color={
                shared
                  ? CLASSIFICATION_COLORS.rankShared
                  : CLASSIFICATION_COLORS.tagInk
              }
              fontSize="compact"
              position={[0, 0.075, -depth / 2 + 0.12]}
            >
              <span className="font-medium">
                {shared
                  ? `${rankNames[rank]}: ${leftLineage[rank]}`
                  : rankNames[rank]}
              </span>
            </ThreeLabel>
          </group>
        );
      })}
      <group position={[-Math.max(0.32, perchRadius * 0.42), perchY, 0.18]}>
        <OrganismFigurine organism={first} />
        <ThreeLabel
          color={CLASSIFICATION_COLORS.tagInk}
          fontSize="compact"
          position={[0, 0.36, 0]}
        >
          <span className="font-medium">{organismNames[first] ?? first}</span>
        </ThreeLabel>
      </group>
      <group position={[Math.max(0.32, perchRadius * 0.42), perchY, 0.18]}>
        <OrganismFigurine organism={second} />
        <ThreeLabel
          color={CLASSIFICATION_COLORS.tagInk}
          fontSize="compact"
          position={[0, 0.36, 0]}
        >
          <span className="font-medium">{organismNames[second] ?? second}</span>
        </ThreeLabel>
      </group>
    </group>
  );
}
