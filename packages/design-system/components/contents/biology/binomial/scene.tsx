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
import {
  BotanicalLoupe,
  BotanicalSpecimen,
  CedarDisplayPlinth,
} from "@repo/design-system/components/contents/biology/binomial/specimens";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { BrassPlaque } from "@repo/design-system/components/contents/biology/fixtures";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr } from "effect";

function GardenCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 3.05, 4.6] : [0, 2.58, 3.7]}
      cameraTarget={[0, 0.22, 0.08]}
      fov={38}
      maxDistance={6.8}
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
  const ink = useLabelInk();
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
            <CedarDisplayPlinth
              highlightColor={highlightColor}
              isMatched={isMatched}
            />
            <group position={[0, 0.11, -0.06]}>
              <BotanicalSpecimen plant={plant} />
            </group>
            {/* Engraved antique brass taxonomic nameplate */}
            <BrassPlaque
              highlight={isSelected}
              position={[0, 0.16, 0.36]}
              rotation={[-0.45, 0, 0]}
              subtitle={spec.family.toUpperCase()}
              title={`${spec.genus} ${spec.epithet}`}
            />
            {isSelected ? (
              <BotanicalLoupe position={[0.32, 0.18, 0.24]} />
            ) : null}
            <ThreeLabel
              color={isMatched ? highlightColor : ink}
              fontSize="compact"
              position={[0, z > 0 ? 0.56 : 0.76, z > 0 ? 0.42 : -0.18]}
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
