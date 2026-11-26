import { useFrame, useThree } from "@react-three/fiber";
import type { SilicateMaterial } from "@repo/design-system/components/contents/chemistry/silicate/model";
import { evaluateSilicateLattice } from "@repo/design-system/components/contents/chemistry/silicate/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function SilicateCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.35] : [0, 1.28, 2.7]}
      cameraTarget={[0, 0.58, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function GlassCeramicScene({
  material,
  parts,
}: {
  readonly material: SilicateMaterial;
  readonly parts: Readonly<
    Record<
      "boronNode" | "clayLayer" | "crystalGrain" | "silicaTetrahedron",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const latticeRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const profile = evaluateSilicateLattice(material);

  const nodes = useMemo(
    () =>
      Arr.makeBy(9, (index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const jitterX = profile.isAmorphous
          ? (((index * 7) % 5) - 2) * 0.06
          : 0;
        const jitterY = profile.isAmorphous
          ? (((index * 3) % 5) - 2) * 0.05
          : 0;
        return {
          id: `sil-${index}`,
          isBoron: profile.hasBoron && index % 4 === 1,
          x: -0.46 + col * 0.46 + jitterX,
          y: 0.3 + row * 0.32 + jitterY,
        };
      }),
    [profile.hasBoron, profile.isAmorphous]
  );

  useFrame((_, delta) => {
    if (!playing || latticeRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.6;
    latticeRef.current.rotation.y = Math.sin(phaseRef.current) * 0.25;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <SilicateCamera />
      <group ref={latticeRef}>
        {profile.isAmorphous ? (
          <group>
            {Arr.map(nodes, (node) => (
              <mesh castShadow key={node.id} position={[node.x, node.y, 0]}>
                <tetrahedronGeometry args={[0.14, 0]} />
                <meshStandardMaterial
                  color={
                    node.isBoron
                      ? PROCESS_COLORS.boronMint
                      : PROCESS_COLORS.silicaBlue
                  }
                  opacity={0.82}
                  roughness={0.2}
                  transparent
                />
              </mesh>
            ))}
          </group>
        ) : null}

        {profile.isAmorphous || profile.orderedCrystals ? null : (
          <group>
            <mesh castShadow position={[0, 0.32, 0]}>
              <boxGeometry args={[1.25, 0.14, 0.65]} />
              <meshStandardMaterial
                color={PROCESS_COLORS.alloyBronze}
                roughness={0.75}
              />
            </mesh>
            <mesh castShadow position={[0, 0.56, 0]}>
              <boxGeometry args={[1.25, 0.14, 0.65]} />
              <meshStandardMaterial
                color={PROCESS_COLORS.ceramicIvory}
                roughness={0.7}
              />
            </mesh>
            <mesh castShadow position={[0, 0.8, 0]}>
              <boxGeometry args={[1.25, 0.14, 0.65]} />
              <meshStandardMaterial
                color={PROCESS_COLORS.alloyBronze}
                roughness={0.75}
              />
            </mesh>
          </group>
        )}

        {profile.orderedCrystals ? (
          <group>
            {Arr.map(nodes, (node) => (
              <mesh castShadow key={node.id} position={[node.x, node.y, 0]}>
                <octahedronGeometry args={[0.14, 0]} />
                <meshStandardMaterial
                  color={PROCESS_COLORS.ceramicIvory}
                  metalness={0.2}
                  roughness={0.28}
                />
              </mesh>
            ))}
          </group>
        ) : null}
      </group>

      {/* Labels */}
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 1.02, 0]}
      >
        <span>
          {profile.isAmorphous ? parts.silicaTetrahedron : parts.clayLayer}
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.78, 1.02, 0]}
      >
        <span>{profile.hasBoron ? parts.boronNode : parts.crystalGrain}</span>
      </ThreeLabel>
    </group>
  );
}
