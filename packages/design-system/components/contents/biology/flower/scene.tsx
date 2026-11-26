import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useFlowerGeometries } from "@repo/design-system/components/contents/biology/flower/anatomy";
import type { PollinationMode } from "@repo/design-system/components/contents/biology/flower/model";
import { evaluatePollinationTraits } from "@repo/design-system/components/contents/biology/flower/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

const OVULE_SLOTS = [
  { id: "ov1", pos: [0, 0.47, 0.02] as const },
  { id: "ov2", pos: [-0.048, 0.54, 0.015] as const },
  { id: "ov3", pos: [0.048, 0.54, 0.015] as const },
] as const;

function FlowerCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.4] : [0, 1.32, 2.82]}
      cameraTarget={[0, 0.66, 0]}
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
  const ink = useLabelInk();
  const pollenRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const traits = evaluatePollinationTraits(mode);
  const geos = useFlowerGeometries(
    mode,
    traits.petalScale,
    traits.filamentLength
  );

  useVisualStop(() => {
    phaseRef.current = 0;
    if (pollenRef.current !== null) {
      pollenRef.current.position.set(0.22, 0.98, 0.14);
    }
  });

  useFrame((_, delta) => {
    if (!playing || pollenRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * (mode === "wind" ? 1.8 : 0.9);
    const t = phaseRef.current % 1;
    pollenRef.current.position.set(
      0.34 - t * 0.68,
      0.98 + Math.sin(t * Math.PI) * 0.16,
      0.14
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <FlowerCamera />

      {/* Pedicel & floral receptacle */}
      <mesh castShadow geometry={geos.receptacle} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.32}
          color={BOTANY_COLORS.stemGreen}
          roughness={0.48}
        />
      </mesh>

      {/* 5 gracefully recurved calyx sepals */}
      <mesh castShadow geometry={geos.sepals} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.28}
          roughness={0.48}
          side={DoubleSide}
          vertexColors
        />
      </mesh>

      {/* 5 sculpted cupped silky petals / wind bracts */}
      <mesh castShadow geometry={geos.petals} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.26}
          clearcoatRoughness={0.42}
          roughness={0.42}
          side={DoubleSide}
          vertexColors
        />
      </mesh>

      {/* Pear-shaped cutaway ovary + 3 pearlescent ovules */}
      <mesh
        castShadow
        geometry={geos.ovaryShell}
        position={[0, 0.36, 0]}
        receiveShadow
      >
        <meshPhysicalMaterial
          clearcoat={0.44}
          color={BOTANY_COLORS.ovaryGreen}
          opacity={0.86}
          roughness={0.38}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {Arr.map(OVULE_SLOTS, (ov) => (
        <mesh
          castShadow
          key={ov.id}
          position={ov.pos}
          scale={[0.88, 1.15, 0.88]}
        >
          <sphereGeometry args={[0.044, 16, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.68}
            color={BOTANY_COLORS.ovuleWhite}
            roughness={0.24}
          />
        </mesh>
      ))}

      {/* Tapered style + 3-lobed sticky stigma (insect) or feathery plumose stigma (wind) */}
      <mesh castShadow position={[0, 0.84, 0]}>
        <cylinderGeometry args={[0.028, 0.044, 0.38, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.35}
          color={BOTANY_COLORS.ovaryGreen}
          roughness={0.44}
        />
      </mesh>
      <group position={[0, 1.04, 0]}>
        {mode === "wind"
          ? Arr.map(geos.plumoseBranches, (br) => (
              <mesh castShadow geometry={br.geo} key={br.id}>
                <meshStandardMaterial
                  color={BOTANY_COLORS.stigmaRose}
                  roughness={0.5}
                />
              </mesh>
            ))
          : Arr.map([-0.036, 0, 0.036] as const, (xOff) => (
              <mesh
                castShadow
                key={`lobe-${xOff}`}
                position={[
                  xOff,
                  xOff === 0 ? 0.02 : 0,
                  xOff === 0 ? 0.025 : -0.01,
                ]}
              >
                <sphereGeometry args={[0.042, 16, 12]} />
                <meshPhysicalMaterial
                  clearcoat={0.78}
                  color={BOTANY_COLORS.stigmaRose}
                  roughness={0.22}
                />
              </mesh>
            ))}
      </group>

      {/* Curving filaments & bilobed golden pollen-dusted anthers */}
      {Arr.map(geos.stamens, (stamen) => (
        <group key={stamen.id}>
          <mesh castShadow geometry={stamen.filament}>
            <meshPhysicalMaterial
              clearcoat={0.28}
              color={BOTANY_COLORS.filamentCream}
              roughness={0.44}
            />
          </mesh>
          <group position={stamen.tip}>
            <mesh castShadow position={[-0.018, 0, 0]}>
              <capsuleGeometry args={[0.024, 0.068, 8, 12]} />
              <meshPhysicalMaterial
                clearcoat={0.35}
                color={BOTANY_COLORS.antherGold}
                roughness={0.42}
              />
            </mesh>
            <mesh castShadow position={[0.018, 0, 0]}>
              <capsuleGeometry args={[0.024, 0.068, 8, 12]} />
              <meshPhysicalMaterial
                clearcoat={0.35}
                color={BOTANY_COLORS.antherGold}
                roughness={0.42}
              />
            </mesh>
          </group>
        </group>
      ))}

      {/* Drifting golden pollen grains */}
      <group position={[0.22, 0.98, 0.14]} ref={pollenRef}>
        <mesh castShadow>
          <sphereGeometry args={[traits.pollenSize, 14, 12]} />
          <meshPhysicalMaterial
            clearcoat={0.45}
            color={BOTANY_COLORS.antherGold}
            emissive={BOTANY_COLORS.antherGold}
            emissiveIntensity={0.2}
            roughness={0.35}
          />
        </mesh>
        {mode === "wind" ? (
          <mesh position={[-0.1, 0.06, -0.04]}>
            <sphereGeometry args={[traits.pollenSize * 0.8, 10, 8]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.antherGold}
              roughness={0.4}
            />
          </mesh>
        ) : null}
      </group>

      {/* Crisp non-overlapping labels */}
      <ThreeLabel color={ink} fontSize="compact" position={[0, 1.24, 0]}>
        <span>{parts.stigma}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.82, 0.96, 0]}>
        <span>{parts.petal}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.82, 1.04, 0]}>
        <span>{parts.anther}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.82, 0.68, 0]}>
        <span>{parts.filament}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.8, 0.64, 0]}>
        <span>{parts.style}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.78, 0.36, 0]}>
        <span>
          {parts.ovary} / {parts.ovule}
        </span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.76, 0.24, 0]}>
        <span>{parts.sepal}</span>
      </ThreeLabel>
    </group>
  );
}
