import { useFrame, useThree } from "@react-three/fiber";
import type { PollinationMode } from "@repo/design-system/components/contents/biology/flower/model";
import { evaluatePollinationTraits } from "@repo/design-system/components/contents/biology/flower/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function FlowerCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.3] : [0, 1.32, 2.7]}
      cameraTarget={[0, 0.64, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function FlowerAnatomyScene({
  mode,
  parts,
}: {
  readonly mode: PollinationMode;
  readonly parts: Readonly<
    Record<
      | "anther"
      | "filament"
      | "ovary"
      | "ovule"
      | "petal"
      | "sepal"
      | "stigma"
      | "style",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const pollenRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const traits = evaluatePollinationTraits(mode);

  const petals = useMemo(
    () =>
      Arr.makeBy(4, (index) => ({
        angle: -0.9 + index * 0.6,
        id: `pet-${index}`,
      })),
    []
  );

  useFrame((_, delta) => {
    if (!playing || pollenRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * (mode === "wind" ? 1.8 : 0.9);
    const t = phaseRef.current % 1;
    pollenRef.current.position.set(
      0.32 - t * 0.68,
      0.95 + Math.sin(t * Math.PI) * 0.18,
      0.16
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <FlowerCamera />
      {/* Pedicel and receptacle */}
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.32, 12]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.stemGreen}
          roughness={0.55}
        />
      </mesh>
      {/* Sepals */}
      <mesh position={[-0.24, 0.34, 0]} rotation={[0, 0, 0.7]}>
        <coneGeometry args={[0.08, 0.32, 10]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.sepalGreen}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[0.24, 0.34, 0]} rotation={[0, 0, -0.7]}>
        <coneGeometry args={[0.08, 0.32, 10]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.sepalGreen}
          roughness={0.55}
        />
      </mesh>
      {/* Petals (bright and large for insect, small green bracts for wind) */}
      {Arr.map(petals, (petal) => (
        <mesh
          castShadow
          key={petal.id}
          position={[
            Math.sin(petal.angle) * 0.36 * traits.petalScale,
            0.62,
            -0.14,
          ]}
          rotation={[0, 0, -petal.angle * 0.6]}
          scale={[0.85 * traits.petalScale, 1.35 * traits.petalScale, 0.18]}
        >
          <sphereGeometry args={[0.24, 14, 12]} />
          <meshStandardMaterial
            color={
              mode === "insect"
                ? BOTANY_COLORS.flowerPink
                : BOTANY_COLORS.windGreen
            }
            roughness={0.42}
          />
        </mesh>
      ))}
      {/* Cutaway ovary and inner ovule */}
      <mesh castShadow position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.18, 16, 14]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.ovaryGreen}
          opacity={0.78}
          roughness={0.45}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.48, 0.08]}>
        <sphereGeometry args={[0.068, 12, 10]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.ovuleWhite}
          roughness={0.35}
        />
      </mesh>
      {/* Style and stigma */}
      <mesh castShadow position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.036, 0.045, 0.42, 12]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.ovaryGreen}
          roughness={0.5}
        />
      </mesh>
      <mesh
        castShadow
        position={[0, 1.02, 0]}
        scale={[traits.stigmaFeatherSpread * 8, 1, 1]}
      >
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.stigmaRose}
          roughness={0.35}
        />
      </mesh>
      {/* Paired filaments and anthers */}
      <mesh
        position={[0.26, 0.56 + traits.filamentLength * 0.45, 0]}
        rotation={[0, 0, -0.25]}
      >
        <cylinderGeometry args={[0.018, 0.018, traits.filamentLength, 10]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.filamentCream}
          roughness={0.5}
        />
      </mesh>
      <mesh castShadow position={[0.32, 0.56 + traits.filamentLength * 0.9, 0]}>
        <capsuleGeometry args={[0.045, 0.09, 6, 12]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.antherGold}
          roughness={0.4}
        />
      </mesh>
      {/* Moving pollen grain */}
      <group position={[0.18, 0.96, 0.16]} ref={pollenRef}>
        <mesh>
          <sphereGeometry args={[traits.pollenSize, 10, 10]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.antherGold}
            roughness={0.35}
          />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.2, 0]}
      >
        <span>{parts.stigma}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.72, 0.92, 0]}
      >
        <span>{parts.petal}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.74, 1.02, 0]}
      >
        <span>{parts.anther}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.72, 0.68, 0]}
      >
        <span>{parts.filament}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.68, 0.66, 0]}
      >
        <span>{parts.style}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, 0.42, 0]}
      >
        <span>
          {parts.ovary} / {parts.ovule}
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.66, 0.24, 0]}
      >
        <span>{parts.sepal}</span>
      </ThreeLabel>
    </group>
  );
}
