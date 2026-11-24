import { useFrame, useThree } from "@react-three/fiber";
import type { FruitType } from "@repo/design-system/components/contents/biology/fruit/model";
import { evaluateFruitOrigin } from "@repo/design-system/components/contents/biology/fruit/model";
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

function FruitCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.3] : [0, 1.25, 2.65]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function FruitSeedScene({
  fruit,
  parts,
}: {
  readonly fruit: FruitType;
  readonly parts: Readonly<
    Record<"cotyledon" | "embryo" | "endosperm" | "pericarp" | "testa", string>
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const fruitRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const origin = evaluateFruitOrigin(fruit);

  const drupelets = useMemo(
    () =>
      Arr.makeBy(origin.carpelCount, (index) => ({
        angle: (index / origin.carpelCount) * Math.PI * 2,
        id: `dr-${index}`,
      })),
    [origin.carpelCount]
  );

  const segments = useMemo(
    () =>
      Arr.makeBy(origin.flowerCount, (index) => ({
        id: `seg-${index}`,
        x: index % 2 === 0 ? -0.14 : 0.14,
        y: 0.2 + Math.floor(index / 2) * 0.18,
      })),
    [origin.flowerCount]
  );

  useFrame((_, delta) => {
    if (!playing || fruitRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.7;
    fruitRef.current.rotation.y = Math.sin(phaseRef.current) * 0.35;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <FruitCamera />
      {/* Left: Fruit type geometry */}
      <group position={[-0.48, 0, 0]} ref={fruitRef}>
        {fruit === "simple" ? (
          <group>
            <mesh castShadow position={[0, 0.54, 0]}>
              <sphereGeometry args={[0.32, 20, 16, 0, Math.PI * 1.4]} />
              <meshStandardMaterial
                color={BOTANY_COLORS.pericarpPeach}
                roughness={0.45}
                side={2}
              />
            </mesh>
            <mesh position={[0, 0.54, 0]}>
              <sphereGeometry args={[0.13, 14, 12]} />
              <meshStandardMaterial
                color={BOTANY_COLORS.testaBrown}
                roughness={0.65}
              />
            </mesh>
          </group>
        ) : null}

        {fruit === "aggregate" ? (
          <group position={[0, 0.54, 0]}>
            {Arr.map(drupelets, (d) => (
              <mesh
                castShadow
                key={d.id}
                position={[
                  Math.cos(d.angle) * 0.15,
                  Math.sin(d.angle) * 0.15,
                  0.04,
                ]}
              >
                <sphereGeometry args={[0.12, 12, 10]} />
                <meshStandardMaterial
                  color={BOTANY_COLORS.fruitRed}
                  roughness={0.38}
                />
              </mesh>
            ))}
          </group>
        ) : null}

        {fruit === "multiple" ? (
          <group>
            {Arr.map(segments, (seg) => (
              <mesh castShadow key={seg.id} position={[seg.x, seg.y, 0]}>
                <boxGeometry args={[0.24, 0.2, 0.24]} />
                <meshStandardMaterial
                  color={BOTANY_COLORS.cotyledonGold}
                  roughness={0.5}
                />
              </mesh>
            ))}
            <mesh position={[0, 0.94, 0]}>
              <coneGeometry args={[0.16, 0.22, 8]} />
              <meshStandardMaterial
                color={BOTANY_COLORS.healthyLeaf}
                roughness={0.55}
              />
            </mesh>
          </group>
        ) : null}
      </group>

      {/* Right: Magnified seed cross-section */}
      <group position={[0.54, 0.54, 0]}>
        {/* Testa seed coat */}
        <mesh castShadow scale={[1.15, 0.85, 0.65]}>
          <sphereGeometry args={[0.26, 18, 14, 0, Math.PI * 1.4]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.testaBrown}
            roughness={0.6}
            side={2}
          />
        </mesh>
        {/* Endosperm reserve */}
        <mesh position={[-0.04, 0.06, 0.04]} scale={[0.9, 0.6, 0.45]}>
          <sphereGeometry args={[0.18, 14, 12]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.endospermIvory}
            roughness={0.55}
          />
        </mesh>
        {/* Cotyledon */}
        <mesh position={[0.04, -0.04, 0.07]} scale={[0.85, 0.6, 0.45]}>
          <sphereGeometry args={[0.15, 14, 12]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.cotyledonGold}
            roughness={0.48}
          />
        </mesh>
        {/* Embryo axis */}
        <mesh position={[-0.08, -0.08, 0.12]} rotation={[0, 0, 0.5]}>
          <capsuleGeometry args={[0.032, 0.1, 6, 10]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.embryoGreen}
            roughness={0.42}
          />
        </mesh>
      </group>

      {/* Labels */}
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.56, 1.04, 0]}
      >
        <span>{parts.pericarp}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.54, 0.96, 0]}
      >
        <span>{parts.testa}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.92, 0.68, 0]}
      >
        <span>{parts.endosperm}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.92, 0.34, 0]}
      >
        <span>{parts.cotyledon}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.32, 0.18, 0.24]}
      >
        <span>{parts.embryo}</span>
      </ThreeLabel>
    </group>
  );
}
