import { useFrame, useThree } from "@react-three/fiber";
import type {
  AnimalResult,
  KeyAnimal,
  KeyEvaluation,
} from "@repo/design-system/components/contents/biology/key/model";
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

const CENTIPEDE_SEGMENTS = [-0.14, -0.07, 0, 0.07, 0.14] as const;
const WORM_RINGS = [-0.12, -0.06, 0, 0.06, 0.12] as const;

function SmallAnimal({ animal }: { readonly animal: KeyAnimal }) {
  return Match.value(animal).pipe(
    Match.when("ant", () => (
      <group>
        <mesh castShadow position={[-0.08, 0.05, 0]}>
          <sphereGeometry args={[0.048, 12, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.antBody}
            roughness={0.48}
          />
        </mesh>
        <mesh castShadow position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.036, 12, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.antBody}
            roughness={0.48}
          />
        </mesh>
        <mesh castShadow position={[0.07, 0.055, 0]}>
          <sphereGeometry args={[0.038, 12, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.antBody}
            roughness={0.48}
          />
        </mesh>
      </group>
    )),
    Match.when("dragonfly", () => (
      <group>
        <mesh castShadow position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.022, 0.22, 8, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.dragonflyBody}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0.02, 0.08, 0.11]} scale={[0.35, 0.08, 1.3]}>
          <sphereGeometry args={[0.08, 10, 8]} />
          <meshPhysicalMaterial
            color={CLASSIFICATION_COLORS.dragonflyWing}
            opacity={0.68}
            roughness={0.2}
            transparent
          />
        </mesh>
        <mesh position={[0.02, 0.08, -0.11]} scale={[0.35, 0.08, 1.3]}>
          <sphereGeometry args={[0.08, 10, 8]} />
          <meshPhysicalMaterial
            color={CLASSIFICATION_COLORS.dragonflyWing}
            opacity={0.68}
            roughness={0.2}
            transparent
          />
        </mesh>
      </group>
    )),
    Match.when("spider", () => (
      <group>
        <mesh castShadow position={[-0.05, 0.06, 0]}>
          <sphereGeometry args={[0.058, 14, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.spiderBody}
            roughness={0.65}
          />
        </mesh>
        <mesh castShadow position={[0.04, 0.055, 0]}>
          <sphereGeometry args={[0.042, 12, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.spiderBody}
            roughness={0.65}
          />
        </mesh>
      </group>
    )),
    Match.when("centipede", () => (
      <group>
        {Arr.map(CENTIPEDE_SEGMENTS, (x) => (
          <mesh castShadow key={x} position={[x, 0.04, 0]}>
            <sphereGeometry args={[0.036, 10, 8]} />
            <meshStandardMaterial
              color={CLASSIFICATION_COLORS.centipedeBody}
              roughness={0.52}
            />
          </mesh>
        ))}
      </group>
    )),
    Match.when("earthworm", () => (
      <group>
        {Arr.map(WORM_RINGS, (x) => (
          <mesh
            castShadow
            key={x}
            position={[x, 0.032, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.024, 0.024, 0.055, 10]} />
            <meshStandardMaterial
              color={CLASSIFICATION_COLORS.earthwormBody}
              roughness={0.6}
            />
          </mesh>
        ))}
      </group>
    )),
    Match.when("snail", () => (
      <group>
        <mesh castShadow position={[0, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.025, 0.14, 8, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.snailBody}
            roughness={0.7}
          />
        </mesh>
        <mesh castShadow position={[-0.02, 0.085, 0]} rotation={[0.3, 0, 0.3]}>
          <coneGeometry args={[0.062, 0.13, 14]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.snailShell}
            roughness={0.62}
          />
        </mesh>
      </group>
    )),
    Match.exhaustive
  );
}

function KeyToken({
  index,
  label,
  result,
  runVersion,
  total,
}: {
  readonly index: number;
  readonly label: string;
  readonly result: AnimalResult;
  readonly runVersion: number;
  readonly total: number;
}) {
  const ref = useRef<Group>(null);
  const playing = useVisualScene((card) => card.playing, false);
  const progress = useRef(runVersion > 0 ? 1 : 0);
  const seenRun = useRef(runVersion);

  const startX = -1.25;
  const startZ = (index - (total - 1) / 2) * 0.42;
  const targetX =
    result.status === "reached" ? 1.25 : 0.15 + (result.step - 1) * 0.2;
  const targetZ = startZ;

  useFrame((_, delta) => {
    const group = ref.current;
    if (group === null) {
      return;
    }
    if (seenRun.current !== runVersion) {
      seenRun.current = runVersion;
      progress.current = 0;
    }
    if (playing || runVersion > 0) {
      const next = Math.min(1, progress.current + simulationStep(delta) * 0.9);
      progress.current = next;
    }
    const t = runVersion === 0 && !playing ? 0 : progress.current;
    const eased = t * t * (3 - 2 * t);
    group.position.set(
      startX + (targetX - startX) * eased,
      0.06 + Math.sin(eased * Math.PI) * 0.08,
      startZ + (targetZ - startZ) * eased
    );
  });

  const badgeColor = Match.value(result.status).pipe(
    Match.when("reached", () => CLASSIFICATION_COLORS.branchActive),
    Match.when("jammed", () => CLASSIFICATION_COLORS.branchBlocked),
    Match.when("grouped", () => CLASSIFICATION_COLORS.tagInk),
    Match.exhaustive
  );

  return (
    <group position={[startX, 0.06, startZ]} ref={ref}>
      <SmallAnimal animal={result.animal} />
      <ThreeLabel color={badgeColor} fontSize="compact" position={[0, 0.22, 0]}>
        <span className="font-medium">{label}</span>
      </ThreeLabel>
    </group>
  );
}

function KeyCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.75, 4.15] : [0, 2.25, 3.25]}
      cameraTarget={[0, 0.12, 0]}
      fov={38}
      maxDistance={6.5}
      minDistance={1.5}
    />
  );
}

export function KeyBuilderScene({
  animalNames,
  evaluation,
  runVersion,
  stepCount,
}: {
  readonly animalNames: Readonly<Partial<Record<KeyAnimal, string>>>;
  readonly evaluation: KeyEvaluation;
  readonly runVersion: number;
  readonly stepCount: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);

  return (
    <group>
      <SimulationTicker running={playing || runVersion > 0} />
      <KeyCamera />
      <mesh castShadow position={[-1.25, 0.025, 0]} receiveShadow>
        <boxGeometry args={[0.92, 0.05, 2.6]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.porcelainTray}
          roughness={0.45}
        />
      </mesh>
      <mesh castShadow position={[0.48, 0.02, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.04, 2.6]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.benchTop}
          roughness={0.82}
        />
      </mesh>
      {Arr.map(Arr.range(0, Math.max(0, stepCount - 1)), (idx) => {
        const x = -0.3 + idx * 0.34;
        return (
          <mesh key={idx} position={[x, 0.05, 0]}>
            <boxGeometry args={[0.04, 0.02, 2.2]} />
            <meshStandardMaterial
              color={CLASSIFICATION_COLORS.branchTrack}
              roughness={0.6}
            />
          </mesh>
        );
      })}
      {Arr.map(evaluation.results, (result, index) => (
        <KeyToken
          index={index}
          key={result.animal}
          label={animalNames[result.animal] ?? result.animal}
          result={result}
          runVersion={runVersion}
          total={evaluation.results.length}
        />
      ))}
    </group>
  );
}
