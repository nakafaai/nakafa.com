import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { AnimalModel } from "@repo/design-system/components/contents/biology/vernacular/animals";
import type {
  SeaAnimal,
  SeaLanguage,
} from "@repo/design-system/components/contents/biology/vernacular/model";
import {
  seaCommonName,
  seaSlotPosition,
  seaSpeciesOf,
} from "@repo/design-system/components/contents/biology/vernacular/model";
import { seabedAt } from "@repo/design-system/components/contents/biology/vernacular/habitat";
import { Seabed } from "@repo/design-system/components/contents/biology/vernacular/seabed";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

function SeaCreature({
  animal,
  commonName,
  index,
  position,
  scientific,
  selected,
}: {
  readonly animal: SeaAnimal;
  readonly commonName: string;
  readonly index: number;
  readonly position: readonly [number, number, number];
  readonly scientific: string;
  readonly selected: boolean;
}) {
  const ref = useRef<Group>(null);
  const ink = useLabelInk();
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(index * 1.1);
  const bed = seabedAt(position[0], position[2]);
  const height = animal === "seaStar" ? bed : position[1];

  useFrame((_, delta) => {
    const group = ref.current;
    if (group === null) {
      return;
    }
    if (playing) {
      clock.current += simulationStep(delta);
    }
    const phase = clock.current;
    const bob = animal === "seaStar" ? 0 : Math.sin(phase * 1.6) * 0.045;
    const sway = animal === "seaStar" ? 0 : Math.sin(phase * 1.2) * 0.08;
    group.position.set(position[0], height + bob, position[2]);
    group.rotation.y = sway;
  });

  return (
    <group position={[position[0], height, position[2]]} ref={ref}>
      <AnimalModel animal={animal} />
      {selected ? (
        <mesh
          position={[0, bed - height + 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.28, 0.34, 32]} />
          <meshBasicMaterial color={CLASSIFICATION_COLORS.tagHighlight} />
        </mesh>
      ) : null}
      <ThreeLabel
        color={selected ? CLASSIFICATION_COLORS.tagHighlight : ink}
        fontSize="compact"
        position={[0, seaSpeciesOf(animal).tag, 0]}
      >
        <span className="flex flex-col items-center leading-tight">
          <span className="font-medium">{commonName}</span>
          <em className="text-[0.82em] opacity-85">{scientific}</em>
        </span>
      </ThreeLabel>
    </group>
  );
}

function SeaCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.86, 4.7] : [0, 0.8, 3.5]}
      cameraTarget={[0, 0.62, 0.05]}
      fov={38}
      maxDistance={7}
      minDistance={1.8}
    />
  );
}

export function SeaNameScene({
  animals,
  language,
  names,
  onSelect,
  selected,
}: {
  readonly animals: readonly SeaAnimal[];
  readonly language: SeaLanguage;
  readonly names: Readonly<
    Partial<Record<SeaAnimal, Readonly<Partial<Record<SeaLanguage, string>>>>>
  >;
  readonly onSelect: (animal: SeaAnimal) => void;
  readonly selected: SeaAnimal;
}) {
  const playing = useVisualScene((card) => card.playing, false);

  return (
    <group>
      <SimulationTicker running={playing} />
      <SeaCamera />
      <mesh
        position={[0, -0.02, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[3.4, 48]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.seaSand}
          roughness={0.92}
        />
      </mesh>
      <Seabed />
      {Arr.map(animals, (animal, index) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: R3F group receives pointer selection while toolbar controls provide keyboard access.
        <group
          key={animal}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(animal);
          }}
        >
          <SeaCreature
            animal={animal}
            commonName={seaCommonName(names, animal, language)}
            index={index}
            position={seaSlotPosition(animals, animal)}
            scientific={seaSpeciesOf(animal).scientific}
            selected={animal === selected}
          />
        </group>
      ))}
    </group>
  );
}
