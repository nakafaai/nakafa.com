import { useFrame, useThree } from "@react-three/fiber";
import type {
  SeaAnimal,
  SeaLanguage,
} from "@repo/design-system/components/contents/biology/vernacular/model";
import {
  seaCommonName,
  seaSlotPosition,
  seaSpeciesOf,
} from "@repo/design-system/components/contents/biology/vernacular/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr, Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const SEA_STAR_ARMS = [0, 1, 2, 3, 4] as const;
const JELLY_TENTACLES = [-0.1, -0.05, 0, 0.05, 0.1] as const;

function DugongBody() {
  return (
    <group>
      <mesh
        castShadow
        rotation={[0, 0, Math.PI / 2]}
        scale={[0.72, 1.45, 0.78]}
      >
        <sphereGeometry args={[0.24, 24, 18]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.dugong}
          roughness={0.62}
        />
      </mesh>
      <mesh castShadow position={[0.32, -0.05, 0]} scale={[1.1, 0.8, 0.9]}>
        <sphereGeometry args={[0.13, 18, 14]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.dugong}
          roughness={0.65}
        />
      </mesh>
      <mesh
        castShadow
        position={[-0.42, 0, 0]}
        rotation={[0, 0, 0.1]}
        scale={[0.35, 0.08, 1.3]}
      >
        <boxGeometry args={[0.5, 0.35, 0.32]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.dugong}
          roughness={0.58}
        />
      </mesh>
      <mesh
        castShadow
        position={[0.08, -0.1, 0.17]}
        rotation={[0.5, 0.3, -0.3]}
        scale={[0.9, 0.25, 1.3]}
      >
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.dugong}
          roughness={0.62}
        />
      </mesh>
      <mesh
        castShadow
        position={[0.08, -0.1, -0.17]}
        rotation={[-0.5, -0.3, -0.3]}
        scale={[0.9, 0.25, 1.3]}
      >
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.dugong}
          roughness={0.62}
        />
      </mesh>
    </group>
  );
}

function WhaleBody() {
  return (
    <group>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} scale={[0.68, 2.1, 0.8]}>
        <sphereGeometry args={[0.26, 28, 20]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.whale}
          roughness={0.44}
        />
      </mesh>
      <mesh
        position={[0.14, -0.09, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[0.52, 1.65, 0.7]}
      >
        <sphereGeometry args={[0.2, 20, 14]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.whaleBelly}
          roughness={0.55}
        />
      </mesh>
      <mesh castShadow position={[-0.25, 0.19, 0]} rotation={[0, 0, 0.35]}>
        <coneGeometry args={[0.06, 0.16, 12]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.whale}
          roughness={0.44}
        />
      </mesh>
      <mesh castShadow position={[-0.64, 0.02, 0]} scale={[0.32, 0.06, 1.55]}>
        <boxGeometry args={[0.45, 0.3, 0.35]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.whale}
          roughness={0.44}
        />
      </mesh>
    </group>
  );
}

function JellyfishBody() {
  return (
    <group>
      <mesh castShadow position={[0, 0.08, 0]} scale={[1, 0.72, 1]}>
        <sphereGeometry
          args={[0.22, 24, 16, 0, Math.PI * 2, 0, Math.PI / 1.8]}
        />
        <meshPhysicalMaterial
          color={CLASSIFICATION_COLORS.jellyfish}
          opacity={0.78}
          roughness={0.2}
          transparent
        />
      </mesh>
      {Arr.map(JELLY_TENTACLES, (offset) => (
        <mesh key={offset} position={[offset, -0.14, offset * 0.6]}>
          <cylinderGeometry args={[0.008, 0.004, 0.34, 8]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.jellyfish}
            opacity={0.72}
            roughness={0.35}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function SeaStarBody() {
  return (
    <group>
      <mesh castShadow scale={[1, 0.35, 1]}>
        <sphereGeometry args={[0.14, 16, 12]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.seaStar}
          roughness={0.72}
        />
      </mesh>
      {Arr.map(SEA_STAR_ARMS, (arm) => {
        const angle = (arm * Math.PI * 2) / 5;
        return (
          <group key={arm} rotation={[0, angle, 0]}>
            <mesh
              castShadow
              position={[0.18, 0, 0]}
              rotation={[0, 0, -Math.PI / 2]}
            >
              <coneGeometry args={[0.065, 0.28, 12]} />
              <meshStandardMaterial
                color={CLASSIFICATION_COLORS.seaStar}
                roughness={0.72}
              />
            </mesh>
            <mesh position={[0.14, 0.045, 0]}>
              <coneGeometry args={[0.018, 0.04, 8]} />
              <meshStandardMaterial
                color={CLASSIFICATION_COLORS.seaStarSpike}
                roughness={0.68}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function MackerelBody() {
  return (
    <group>
      <mesh
        castShadow
        rotation={[0, 0, Math.PI / 2]}
        scale={[0.45, 1.55, 0.32]}
      >
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.mackerel}
          metalness={0.35}
          roughness={0.28}
        />
      </mesh>
      <mesh
        position={[0, -0.04, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[0.36, 1.38, 0.28]}
      >
        <sphereGeometry args={[0.16, 18, 12]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.mackerelBelly}
          metalness={0.3}
          roughness={0.32}
        />
      </mesh>
      <mesh
        castShadow
        position={[-0.36, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[0.85, 0.55, 0.14]}
      >
        <coneGeometry args={[0.14, 0.22, 10]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.mackerel}
          roughness={0.35}
        />
      </mesh>
      <mesh castShadow position={[0.02, 0.11, 0]} rotation={[0, 0, 0.25]}>
        <coneGeometry args={[0.045, 0.1, 8]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.mackerel}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

function AnimalModel({ animal }: { readonly animal: SeaAnimal }) {
  return Match.value(animal).pipe(
    Match.when("dugong", () => <DugongBody />),
    Match.when("whale", () => <WhaleBody />),
    Match.when("jellyfish", () => <JellyfishBody />),
    Match.when("seaStar", () => <SeaStarBody />),
    Match.when("mackerel", () => <MackerelBody />),
    Match.exhaustive
  );
}

function SeaCreature({
  animal,
  commonName,
  index,
  onSelect,
  position,
  scientific,
  selected,
}: {
  readonly animal: SeaAnimal;
  readonly commonName: string;
  readonly index: number;
  readonly onSelect: (animal: SeaAnimal) => void;
  readonly position: readonly [number, number, number];
  readonly scientific: string;
  readonly selected: boolean;
}) {
  const ref = useRef<Group>(null);
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(index * 1.1);

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
    group.position.set(position[0], position[1] + bob, position[2]);
    group.rotation.y = sway;
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group receives pointer selection while toolbar controls provide keyboard access.
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect(animal);
      }}
      position={[position[0], position[1], position[2]]}
      ref={ref}
    >
      <AnimalModel animal={animal} />
      {selected ? (
        <mesh
          position={[0, -position[1] + 0.015, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.28, 0.34, 32]} />
          <meshBasicMaterial color={CLASSIFICATION_COLORS.tagHighlight} />
        </mesh>
      ) : null}
      <ThreeLabel
        color={
          selected
            ? CLASSIFICATION_COLORS.tagHighlight
            : CLASSIFICATION_COLORS.tagInk
        }
        fontSize="compact"
        position={[0, animal === "seaStar" ? 0.24 : 0.36, 0]}
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
      cameraPosition={narrow ? [0, 2.35, 4.7] : [0, 1.9, 3.85]}
      cameraTarget={[0, 0.38, 0.05]}
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
      <mesh position={[0, 1.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.35, 48]} />
        <meshPhysicalMaterial
          color={CLASSIFICATION_COLORS.seaShallow}
          opacity={0.22}
          roughness={0.18}
          transparent
        />
      </mesh>
      {Arr.map(animals, (animal, index) => (
        <SeaCreature
          animal={animal}
          commonName={seaCommonName(names, animal, language)}
          index={index}
          key={animal}
          onSelect={onSelect}
          position={seaSlotPosition(animals, animal)}
          scientific={seaSpeciesOf(animal).scientific}
          selected={animal === selected}
        />
      ))}
    </group>
  );
}
