import { useThree } from "@react-three/fiber";
import type {
  KingdomId,
  SpecimenId,
} from "@repo/design-system/components/contents/biology/kingdom/model";
import {
  isPlacementRight,
  KINGDOMS,
  kingdomTrayPosition,
} from "@repo/design-system/components/contents/biology/kingdom/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr, Match, Option } from "effect";

const KINGDOM_TINT: Readonly<Record<KingdomId, string>> = {
  animalia: CLASSIFICATION_COLORS.trayAnimalia,
  archaebacteria: CLASSIFICATION_COLORS.trayArchaea,
  eubacteria: CLASSIFICATION_COLORS.trayEubacteria,
  fungi: CLASSIFICATION_COLORS.trayFungi,
  plantae: CLASSIFICATION_COLORS.trayPlantae,
  protista: CLASSIFICATION_COLORS.trayProtista,
};

const SPIROGYRA_CELLS = [-0.22, -0.08, 0.08, 0.22] as const;
const HYDRA_TENTACLES = [0, 1, 2, 3, 4] as const;

function SpecimenModel({ specimen }: { readonly specimen: SpecimenId }) {
  return Match.value(specimen).pipe(
    Match.when("sulfolobus", () => (
      <group>
        <mesh castShadow>
          <dodecahedronGeometry args={[0.17, 1]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.trayArchaea}
            roughness={0.55}
          />
        </mesh>
        <mesh scale={[1.12, 1.12, 1.12]}>
          <dodecahedronGeometry args={[0.17, 0]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.cellWall}
            opacity={0.35}
            transparent
            wireframe
          />
        </mesh>
      </group>
    )),
    Match.when("thermus", () => (
      <group>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.09, 0.26, 10, 16]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.trayEubacteria}
            roughness={0.48}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.11, 0.27, 8, 14]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.cellWall}
            opacity={0.35}
            transparent
          />
        </mesh>
      </group>
    )),
    Match.when("paramecium", () => (
      <group>
        <mesh
          castShadow
          rotation={[0, 0, Math.PI / 2]}
          scale={[0.72, 1.45, 0.6]}
        >
          <sphereGeometry args={[0.15, 20, 14]} />
          <meshPhysicalMaterial
            color={CLASSIFICATION_COLORS.cellCytoplasm}
            opacity={0.82}
            roughness={0.3}
            transparent
          />
        </mesh>
        <mesh position={[0.02, 0.01, 0]}>
          <sphereGeometry args={[0.055, 14, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.cellNucleus}
            roughness={0.5}
          />
        </mesh>
      </group>
    )),
    Match.when("spirogyra", () => (
      <group>
        {Arr.map(SPIROGYRA_CELLS, (x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.075, 0.075, 0.13, 14]} />
              <meshPhysicalMaterial
                color={CLASSIFICATION_COLORS.cellCytoplasm}
                opacity={0.7}
                roughness={0.3}
                transparent
              />
            </mesh>
            <mesh rotation={[0.4, 0, Math.PI / 2]}>
              <torusGeometry args={[0.045, 0.012, 8, 16]} />
              <meshStandardMaterial
                color={CLASSIFICATION_COLORS.leafBright}
                roughness={0.45}
              />
            </mesh>
          </group>
        ))}
      </group>
    )),
    Match.when("slimeMould", () => (
      <group>
        <mesh castShadow scale={[1.3, 0.32, 1.1]}>
          <dodecahedronGeometry args={[0.18, 1]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.slimeGold}
            roughness={0.52}
          />
        </mesh>
        <mesh position={[0.18, 0.02, 0.08]} scale={[0.7, 0.25, 0.6]}>
          <sphereGeometry args={[0.12, 12, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.slimeGold}
            roughness={0.52}
          />
        </mesh>
      </group>
    )),
    Match.when("yeast", () => (
      <group>
        <mesh castShadow scale={[1.0, 1.2, 1.0]}>
          <sphereGeometry args={[0.13, 18, 14]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.mushroomCap}
            roughness={0.55}
          />
        </mesh>
        <mesh castShadow position={[0.12, 0.1, 0]}>
          <sphereGeometry args={[0.068, 14, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.mushroomCap}
            roughness={0.55}
          />
        </mesh>
      </group>
    )),
    Match.when("mushroom", () => (
      <group position={[0, -0.08, 0]}>
        <mesh castShadow position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.045, 0.055, 0.18, 12]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.mushroomCap}
            roughness={0.75}
          />
        </mesh>
        <mesh castShadow position={[0, 0.2, 0]} scale={[1.35, 0.45, 1.2]}>
          <sphereGeometry
            args={[0.14, 18, 12, 0, Math.PI * 2, 0, Math.PI / 1.8]}
          />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.trayFungi}
            roughness={0.62}
          />
        </mesh>
      </group>
    )),
    Match.when("fern", () => (
      <group position={[0, -0.08, 0]}>
        <mesh castShadow position={[0, 0.14, 0]} rotation={[0.15, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.02, 0.3, 8]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leafDeep}
            roughness={0.65}
          />
        </mesh>
        <mesh castShadow position={[0, 0.22, 0.02]} scale={[1.4, 1.1, 0.2]}>
          <coneGeometry args={[0.12, 0.26, 6]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leafBright}
            roughness={0.58}
          />
        </mesh>
      </group>
    )),
    Match.when("padi", () => (
      <group position={[0, -0.08, 0]}>
        <mesh castShadow position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.014, 0.018, 0.32, 8]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leafBright}
            roughness={0.62}
          />
        </mesh>
        <mesh castShadow position={[0.04, 0.3, 0]} rotation={[0, 0, -0.5]}>
          <capsuleGeometry args={[0.024, 0.12, 6, 8]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.padiGold}
            roughness={0.5}
          />
        </mesh>
      </group>
    )),
    Match.when("hydra", () => (
      <group position={[0, -0.08, 0]}>
        <mesh castShadow position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.032, 0.045, 0.24, 12]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.hydraBody}
            roughness={0.52}
          />
        </mesh>
        {Arr.map(HYDRA_TENTACLES, (idx) => {
          const angle = (idx * Math.PI * 2) / 5;
          return (
            <mesh
              key={idx}
              position={[Math.cos(angle) * 0.07, 0.28, Math.sin(angle) * 0.07]}
              rotation={[Math.sin(angle) * 0.65, 0, -Math.cos(angle) * 0.65]}
            >
              <cylinderGeometry args={[0.008, 0.012, 0.14, 6]} />
              <meshStandardMaterial
                color={CLASSIFICATION_COLORS.hydraBody}
                roughness={0.52}
              />
            </mesh>
          );
        })}
      </group>
    )),
    Match.exhaustive
  );
}

function KingdomCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.75, 4.15] : [0, 2.15, 3.3]}
      cameraTarget={[0, 0.2, 0.2]}
      fov={38}
      maxDistance={6.5}
      minDistance={1.5}
    />
  );
}

function trayBorderColor(
  specimen: SpecimenId,
  kingdom: KingdomId,
  isChosen: boolean,
  showFeedback: boolean,
  tint: string
) {
  if (!(isChosen && showFeedback)) {
    return tint;
  }
  return isPlacementRight(specimen, kingdom)
    ? CLASSIFICATION_COLORS.trayCorrect
    : CLASSIFICATION_COLORS.trayWrong;
}

export function KingdomSortScene({
  kingdomNames,
  onPlace,
  placed,
  showFeedback,
  specimen,
}: {
  readonly kingdomNames: Readonly<Record<KingdomId, string>>;
  readonly onPlace: (tray: KingdomId) => void;
  readonly placed: Option.Option<KingdomId>;
  readonly showFeedback: boolean;
  readonly specimen: SpecimenId;
}) {
  return (
    <group>
      <KingdomCamera />
      <mesh position={[0, -0.03, 0.18]} receiveShadow>
        <boxGeometry args={[3.9, 0.06, 2.5]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.benchTop}
          roughness={0.85}
        />
      </mesh>
      <group position={[0, 0.02, -0.58]}>
        <mesh castShadow position={[-0.62, 0.06, 0]}>
          <boxGeometry args={[0.36, 0.12, 0.44]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.microscopeEnamel}
            roughness={0.4}
          />
        </mesh>
        <mesh castShadow position={[-0.62, 0.34, -0.1]}>
          <boxGeometry args={[0.09, 0.5, 0.1]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.microscopeBlack}
            roughness={0.45}
          />
        </mesh>
        <mesh castShadow position={[-0.62, 0.5, 0.04]} rotation={[0.35, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.045, 0.26, 12]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.microscopeBlack}
            roughness={0.4}
          />
        </mesh>
        <mesh castShadow position={[0, 0.04, 0]} receiveShadow>
          <cylinderGeometry args={[0.42, 0.45, 0.08, 32]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.trayBase}
            roughness={0.5}
          />
        </mesh>
        <group position={[0, 0.28, 0]}>
          <SpecimenModel specimen={specimen} />
        </group>
      </group>
      {Arr.map(KINGDOMS, (kingdom, index) => {
        const [x, y, z] = kingdomTrayPosition(index);
        const isChosen = Option.contains(placed, kingdom);
        const tint = KINGDOM_TINT[kingdom];
        const borderColor = trayBorderColor(
          specimen,
          kingdom,
          isChosen,
          showFeedback,
          tint
        );
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: R3F group receives pointer placement while toolbar controls provide keyboard access.
          <group
            key={kingdom}
            onClick={(event) => {
              event.stopPropagation();
              onPlace(kingdom);
            }}
            position={[x, y, z]}
          >
            <mesh castShadow position={[0, 0.035, 0]} receiveShadow>
              <boxGeometry args={[0.96, 0.07, 0.56]} />
              <meshStandardMaterial color={borderColor} roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.06, 0]} receiveShadow>
              <boxGeometry args={[0.84, 0.03, 0.44]} />
              <meshStandardMaterial
                color={CLASSIFICATION_COLORS.trayBase}
                roughness={0.7}
              />
            </mesh>
            {isChosen ? (
              <group position={[0, 0.16, 0]} scale={[0.52, 0.52, 0.52]}>
                <SpecimenModel specimen={specimen} />
              </group>
            ) : null}
            <ThreeLabel
              color={CLASSIFICATION_COLORS.tagInk}
              fontSize="compact"
              position={[0, 0.16, 0.29]}
            >
              <span className="font-medium">{kingdomNames[kingdom]}</span>
            </ThreeLabel>
          </group>
        );
      })}
    </group>
  );
}
