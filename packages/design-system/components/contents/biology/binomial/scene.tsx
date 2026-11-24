import { useThree } from "@react-three/fiber";
import type {
  GardenPlant,
  MatchMode,
  NameStyle,
} from "@repo/design-system/components/contents/biology/binomial/model";
import {
  botanicalOf,
  gardenBedPosition,
} from "@repo/design-system/components/contents/biology/binomial/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr, Match } from "effect";

const RICE_STALKS = [-0.14, -0.06, 0.02, 0.1, 0.16] as const;
const VINE_LEAVES = [
  [-0.18, 0.12, 0.08],
  [0.14, 0.14, -0.06],
  [-0.04, 0.16, -0.14],
  [0.12, 0.12, 0.14],
] as const;

function PlantFoliage({ plant }: { readonly plant: GardenPlant }) {
  return Match.value(plant).pipe(
    Match.when("kangkung", () => (
      <group>
        {Arr.map(VINE_LEAVES, (pos, idx) => (
          <mesh
            castShadow
            key={`${pos[0]}-${pos[2]}`}
            position={[pos[0], pos[1], pos[2]]}
            rotation={[0.2, idx * 1.1, 0.15]}
          >
            <coneGeometry args={[0.075, 0.18, 6]} />
            <meshStandardMaterial
              color={CLASSIFICATION_COLORS.leafFresh}
              roughness={0.62}
            />
          </mesh>
        ))}
      </group>
    )),
    Match.when("sweetPotato", () => (
      <group>
        <mesh
          castShadow
          position={[0.08, 0.05, 0.1]}
          rotation={[0, 0.4, Math.PI / 2]}
          scale={[0.7, 1.4, 0.7]}
        >
          <sphereGeometry args={[0.07, 14, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.tuberPurple}
            roughness={0.78}
          />
        </mesh>
        {Arr.map(VINE_LEAVES, (pos) => (
          <mesh
            castShadow
            key={`${pos[0]}-${pos[2]}`}
            position={[pos[0], pos[1] + 0.02, pos[2]]}
            scale={[1.2, 0.35, 1.1]}
          >
            <sphereGeometry args={[0.085, 12, 10]} />
            <meshStandardMaterial
              color={CLASSIFICATION_COLORS.leafBright}
              roughness={0.6}
            />
          </mesh>
        ))}
      </group>
    )),
    Match.when("mango", () => (
      <group>
        <mesh castShadow position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.028, 0.042, 0.44, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.gardenTimber}
            roughness={0.85}
          />
        </mesh>
        <mesh castShadow position={[0, 0.48, 0]} scale={[1.15, 0.85, 1.15]}>
          <sphereGeometry args={[0.19, 18, 14]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leafDeep}
            roughness={0.58}
          />
        </mesh>
        <mesh
          castShadow
          position={[0.12, 0.34, 0.1]}
          scale={[0.85, 1.15, 0.85]}
        >
          <sphereGeometry args={[0.048, 14, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.mangoFruit}
            roughness={0.42}
          />
        </mesh>
      </group>
    )),
    Match.when("beluntas", () => (
      <group>
        <mesh castShadow position={[0, 0.24, 0]} scale={[1.1, 0.9, 1.1]}>
          <dodecahedronGeometry args={[0.18, 1]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leafBright}
            roughness={0.68}
          />
        </mesh>
        <mesh position={[-0.08, 0.39, 0.06]}>
          <sphereGeometry args={[0.032, 10, 8]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.flowerViolet}
            roughness={0.55}
          />
        </mesh>
        <mesh position={[0.09, 0.37, -0.05]}>
          <sphereGeometry args={[0.03, 10, 8]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.flowerViolet}
            roughness={0.55}
          />
        </mesh>
      </group>
    )),
    Match.when("neem", () => (
      <group>
        <mesh castShadow position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.022, 0.035, 0.5, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.gardenTimber}
            roughness={0.85}
          />
        </mesh>
        <mesh castShadow position={[0, 0.52, 0]} scale={[1.2, 0.72, 1.2]}>
          <icosahedronGeometry args={[0.17, 1]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leafDeep}
            roughness={0.62}
          />
        </mesh>
        <mesh castShadow position={[0.08, 0.38, 0.08]} scale={[0.9, 0.55, 0.9]}>
          <icosahedronGeometry args={[0.11, 1]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leafFresh}
            roughness={0.62}
          />
        </mesh>
      </group>
    )),
    Match.when("padi", () => (
      <group>
        {Arr.map(RICE_STALKS, (offset, idx) => (
          <group
            key={offset}
            position={[offset, 0, (idx % 2 === 0 ? 1 : -1) * 0.05]}
            rotation={[0, 0, offset * 1.1]}
          >
            <mesh castShadow position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.008, 0.012, 0.4, 8]} />
              <meshStandardMaterial
                color={CLASSIFICATION_COLORS.leafBright}
                roughness={0.65}
              />
            </mesh>
            <mesh castShadow position={[0.03, 0.42, 0]} rotation={[0, 0, -0.5]}>
              <capsuleGeometry args={[0.018, 0.1, 6, 8]} />
              <meshStandardMaterial
                color={CLASSIFICATION_COLORS.padiGold}
                roughness={0.55}
              />
            </mesh>
          </group>
        ))}
      </group>
    )),
    Match.exhaustive
  );
}

function GardenCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.75, 4.35] : [0, 2.25, 3.4]}
      cameraTarget={[0, 0.22, 0.05]}
      fov={38}
      maxDistance={6.5}
      minDistance={1.6}
    />
  );
}

export function GardenNameScene({
  matchMode,
  matched,
  onSelect,
  plantNames,
  plants,
  selected,
  style,
}: {
  readonly matchMode: MatchMode;
  readonly matched: readonly GardenPlant[];
  readonly onSelect: (plant: GardenPlant) => void;
  readonly plantNames: Readonly<Partial<Record<GardenPlant, string>>>;
  readonly plants: readonly GardenPlant[];
  readonly selected: GardenPlant;
  readonly style: NameStyle;
}) {
  const highlightColor =
    matchMode === "genus"
      ? CLASSIFICATION_COLORS.matchGenus
      : CLASSIFICATION_COLORS.matchEpithet;

  return (
    <group>
      <GardenCamera />
      {Arr.map(plants, (plant, index) => {
        const [x, y, z] = gardenBedPosition(index, plants.length);
        const spec = botanicalOf(plant);
        const isMatched = Arr.contains(matched, plant);
        const isSelected = plant === selected;
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: R3F group receives pointer selection while toolbar controls provide keyboard access.
          <group
            key={plant}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(plant);
            }}
            position={[x, y, z]}
          >
            <mesh castShadow position={[0, 0.05, 0]} receiveShadow>
              <boxGeometry args={[0.92, 0.1, 0.88]} />
              <meshStandardMaterial
                color={CLASSIFICATION_COLORS.gardenTimber}
                roughness={0.82}
              />
            </mesh>
            <mesh position={[0, 0.095, 0]} receiveShadow>
              <boxGeometry args={[0.82, 0.03, 0.78]} />
              <meshStandardMaterial
                color={CLASSIFICATION_COLORS.gardenSoil}
                roughness={0.94}
              />
            </mesh>
            {isMatched ? (
              <mesh position={[0, 0.115, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.35, 0.41, 32]} />
                <meshBasicMaterial color={highlightColor} />
              </mesh>
            ) : null}
            <group position={[0, 0.1, -0.05]}>
              <PlantFoliage plant={plant} />
            </group>
            <mesh castShadow position={[0, 0.18, 0.32]}>
              <boxGeometry args={[0.025, 0.22, 0.018]} />
              <meshStandardMaterial
                color={CLASSIFICATION_COLORS.stakeWood}
                roughness={0.78}
              />
            </mesh>
            <mesh castShadow position={[0, 0.28, 0.33]}>
              <boxGeometry args={[0.36, 0.11, 0.02]} />
              <meshStandardMaterial
                color={
                  isSelected ? highlightColor : CLASSIFICATION_COLORS.tagCard
                }
                roughness={0.5}
              />
            </mesh>
            <ThreeLabel
              color={isMatched ? highlightColor : CLASSIFICATION_COLORS.tagInk}
              fontSize="compact"
              position={[0, 0.72, 0.14]}
            >
              <span className="flex flex-col items-center leading-tight">
                <span className="text-[0.8em] opacity-80">
                  {plantNames[plant] ?? plant}
                </span>
                <span className="font-medium">
                  {style === "handwritten" ? (
                    <span>
                      <span className="underline underline-offset-2">
                        {spec.genus}
                      </span>{" "}
                      <span className="underline underline-offset-2">
                        {spec.epithet}
                      </span>
                    </span>
                  ) : (
                    <em>
                      {spec.genus} {spec.epithet}
                    </em>
                  )}
                </span>
              </span>
            </ThreeLabel>
          </group>
        );
      })}
    </group>
  );
}
