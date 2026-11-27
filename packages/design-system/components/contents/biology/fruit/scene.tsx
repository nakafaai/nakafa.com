import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useFruitSeedGeometries } from "@repo/design-system/components/contents/biology/fruit/anatomy";
import type { FruitType } from "@repo/design-system/components/contents/biology/fruit/model";
import { evaluateFruitOrigin } from "@repo/design-system/components/contents/biology/fruit/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

function FruitCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.48, 3.45] : [0, 1.24, 2.85]}
      cameraTarget={[0, 0.54, 0]}
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
  const labelInk = useLabelInk();
  const geos = useFruitSeedGeometries();
  const origin = evaluateFruitOrigin(fruit);
  const fruitRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  useVisualStop(() => {
    phaseRef.current = 0;
    if (fruitRef.current !== null) {
      fruitRef.current.rotation.y = 0;
    }
  });

  useFrame((_, delta) => {
    if (!playing || fruitRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.65;
    fruitRef.current.rotation.y = Math.sin(phaseRef.current) * 0.34;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <FruitCamera />

      {/* Left: Sculpted botanical fruit specimen */}
      <group position={[-0.54, 0.52, 0]} ref={fruitRef}>
        {fruit === "simple" ? (
          <group>
            {/* Velvety peach pericarp outer shell facing +Z cutaway */}
            <mesh castShadow geometry={geos.peachSkin} receiveShadow>
              <meshPhysicalMaterial
                clearcoat={0.18}
                clearcoatRoughness={0.45}
                roughness={0.58}
                side={2}
                vertexColors
              />
            </mesh>
            {/* Juicy inner mesocarp cut faces sealing the wedge */}
            <mesh
              geometry={geos.fleshWall}
              rotation={[0, Math.PI * 0.27 - Math.PI / 2, 0]}
            >
              <meshPhysicalMaterial
                clearcoat={0.42}
                clearcoatRoughness={0.22}
                color={BOTANY_COLORS.cotyledonGold}
                roughness={0.34}
                side={2}
              />
            </mesh>
            <mesh
              geometry={geos.fleshWall}
              rotation={[0, Math.PI * 1.73 - Math.PI / 2, 0]}
            >
              <meshPhysicalMaterial
                clearcoat={0.42}
                clearcoatRoughness={0.22}
                color={BOTANY_COLORS.cotyledonGold}
                roughness={0.34}
                side={2}
              />
            </mesh>
            {/* Corrugated woody endocarp stone pit */}
            <mesh castShadow geometry={geos.pit}>
              <SurfaceMaterial
                color={BOTANY_COLORS.testaBrown}
                roughness={0.82}
                surface="bark"
              />
            </mesh>
            {/* Woody pedicel stem + peach leaf */}
            <mesh castShadow geometry={geos.pedicel}>
              <SurfaceMaterial
                color={BOTANY_COLORS.barkBrown}
                roughness={0.85}
                surface="bark"
              />
            </mesh>
            <mesh castShadow geometry={geos.peachLeaf}>
              <meshPhysicalMaterial
                clearcoat={0.25}
                roughness={0.44}
                side={2}
                vertexColors
              />
            </mesh>
          </group>
        ) : null}

        {fruit === "aggregate" ? (
          <group>
            {/* Central pale receptacle core */}
            <mesh position={[0, 0.02, 0]}>
              <sphereGeometry args={[0.13, 18, 16]} />
              <meshStandardMaterial
                color={BOTANY_COLORS.cortexCream}
                roughness={0.65}
              />
            </mesh>
            {/* Glossy translucent crimson drupelet cluster */}
            {Arr.map(
              Arr.take(geos.drupeletCoords, origin.carpelCount * 3),
              (d) => (
                <group key={d.id} position={[d.x, d.y, d.z]}>
                  <mesh castShadow>
                    <sphereGeometry args={[0.088, 18, 14]} />
                    <meshPhysicalMaterial
                      clearcoat={0.72}
                      clearcoatRoughness={0.14}
                      color={BOTANY_COLORS.fruitRed}
                      roughness={0.22}
                    />
                  </mesh>
                  {/* Tiny style hair tip on each drupelet */}
                  <mesh position={[d.x * 0.45, 0.02, d.z * 0.45]}>
                    <sphereGeometry args={[0.012, 8, 6]} />
                    <meshStandardMaterial
                      color={BOTANY_COLORS.endodermisRust}
                      roughness={0.75}
                    />
                  </mesh>
                </group>
              )
            )}
            {/* Green calyx skirt */}
            <mesh castShadow geometry={geos.berryCalyx}>
              <meshStandardMaterial roughness={0.5} side={2} vertexColors />
            </mesh>
          </group>
        ) : null}

        {fruit === "multiple" ? (
          <group position={[0, -0.02, 0]}>
            {/* Sculpted ovoid syncarp core */}
            <mesh castShadow geometry={geos.pineCore}>
              <meshStandardMaterial roughness={0.58} vertexColors />
            </mesh>
            {/* Overlapping hexagonal fused fruitlet eyes */}
            {Arr.map(
              Arr.take(geos.pineEyes, origin.flowerCount * 3 + 4),
              (eye) => (
                <group
                  key={eye.id}
                  position={[eye.x, eye.y, eye.z]}
                  rotation={[0, -eye.ang + Math.PI / 2, 0]}
                >
                  <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.052, 0.068, 0.036, 6]} />
                    <meshStandardMaterial
                      color={BOTANY_COLORS.agarAmber}
                      roughness={0.48}
                    />
                  </mesh>
                  <mesh position={[0, 0.01, 0.024]}>
                    <sphereGeometry args={[0.018, 10, 8]} />
                    <meshStandardMaterial
                      color={BOTANY_COLORS.ligninBrown}
                      roughness={0.72}
                    />
                  </mesh>
                </group>
              )
            )}
            {/* Lush spiky green rosette crown */}
            <mesh castShadow geometry={geos.pineCrown}>
              <meshPhysicalMaterial
                clearcoat={0.28}
                roughness={0.42}
                side={2}
                vertexColors
              />
            </mesh>
          </group>
        ) : null}
      </group>

      {/* Right: Magnified dicot kidney-bean seed cutaway facing +Z */}
      <group position={[0.56, 0.54, 0]}>
        <mesh castShadow geometry={geos.testaShell} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.28}
            clearcoatRoughness={0.36}
            color={BOTANY_COLORS.testaBrown}
            roughness={0.54}
          />
        </mesh>
        <mesh castShadow geometry={geos.endosperm}>
          <meshStandardMaterial
            color={BOTANY_COLORS.endospermIvory}
            roughness={0.48}
          />
        </mesh>
        <mesh castShadow geometry={geos.cotyledon}>
          <meshPhysicalMaterial
            clearcoat={0.2}
            color={BOTANY_COLORS.cotyledonGold}
            roughness={0.42}
          />
        </mesh>
        <mesh castShadow geometry={geos.embryoAxis}>
          <meshPhysicalMaterial
            clearcoat={0.32}
            color={BOTANY_COLORS.embryoGreen}
            roughness={0.36}
          />
        </mesh>
        <mesh castShadow geometry={geos.plumuleLeaves}>
          <meshStandardMaterial roughness={0.42} side={2} vertexColors />
        </mesh>
      </group>

      {/* Anatomical callouts */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.56, 1.12, 0]}
      >
        <span>{parts.pericarp}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.56, 1.04, 0]}
      >
        <span>{parts.testa}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[1.18, 0.74, 0]}
      >
        <span>{parts.endosperm}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[1.18, 0.34, 0]}
      >
        <span>{parts.cotyledon}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.24, 0.14, 0.22]}
      >
        <span>{parts.embryo}</span>
      </ThreeLabel>
    </group>
  );
}
