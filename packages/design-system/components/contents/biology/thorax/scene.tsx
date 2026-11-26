import { useFrame, useThree } from "@react-three/fiber";
import {
  RIB_LEVELS,
  useAirwayAndSternum,
  useRibArcs,
  useSculptedDiaphragm,
  useSculptedLung,
} from "@repo/design-system/components/contents/biology/thorax/anatomy";
import type { BreathingPhase } from "@repo/design-system/components/contents/biology/thorax/model";
import { evaluateThoraxMechanics } from "@repo/design-system/components/contents/biology/thorax/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOME_COLORS } from "@repo/design-system/lib/material/biome";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

const TRACHEA_RINGS = Arr.makeBy(9, (i) => 1.08 + i * 0.05);

function ThoraxCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.24, 1.28, 3.8] : [0.22, 1.16, 3.12]}
      cameraTarget={[0, 0.68, 0]}
      fov={36}
      maxDistance={6.4}
      minDistance={1.5}
    />
  );
}

export function ThoraxDiaphragmScene({
  depth,
  parts,
  phase,
}: {
  readonly depth: number;
  readonly parts: Readonly<
    Record<
      | "diaphragm"
      | "intercostal"
      | "lungs"
      | "pleuralCavity"
      | "ribcage"
      | "trachea",
      string
    >
  >;
  readonly phase: BreathingPhase;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const lungsRef = useRef<Group>(null);
  const ribsRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const mechanics = evaluateThoraxMechanics(phase, depth);

  const leftLung = useSculptedLung("left");
  const rightLung = useSculptedLung("right");
  const diaphragm = useSculptedDiaphragm();
  const ribs = useRibArcs();
  const { leftBronchus, rightBronchus, sternum } = useAirwayAndSternum();

  useFrame((_, delta) => {
    if (!playing || lungsRef.current === null || ribsRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 2.1;
    const pulse = 1 + Math.sin(phaseRef.current) * 0.045;
    lungsRef.current.scale.setScalar(mechanics.lungScale * pulse);
    const ribExpand = 0.94 + mechanics.lungScale * 0.08 * pulse;
    ribsRef.current.scale.set(ribExpand, 1, ribExpand);
  });

  const ribExpandStatic = 0.93 + mechanics.lungScale * 0.08;
  const ribPitch = (mechanics.lungScale - 1) * -0.22;
  const intercostalTension = phase === "inhalation" ? 0.56 : 0.32;

  return (
    <group>
      <SimulationTicker running={playing} />
      <ThoraxCamera />

      {/* Fibrous trachea with C-shaped hyaline cartilage rings & bronchial bifurcation */}
      <group>
        <mesh castShadow position={[0, 1.3, -0.02]}>
          <cylinderGeometry args={[0.068, 0.072, 0.48, 22]} />
          <meshPhysicalMaterial
            clearcoat={0.28}
            color={BIOME_COLORS.tracheaTissue}
            roughness={0.46}
          />
        </mesh>
        {Arr.map(TRACHEA_RINGS, (y) => (
          <mesh key={y} position={[0, y, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.073, 0.011, 10, 26]} />
            <meshPhysicalMaterial
              clearcoat={0.45}
              color={BIOME_COLORS.tracheaRing}
              roughness={0.32}
            />
          </mesh>
        ))}
        <mesh castShadow geometry={leftBronchus}>
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={BIOME_COLORS.tracheaTissue}
            roughness={0.46}
          />
        </mesh>
        <mesh castShadow geometry={rightBronchus}>
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={BIOME_COLORS.tracheaTissue}
            roughness={0.46}
          />
        </mesh>
      </group>

      {/* Sculpted anatomical paired lungs with fissures & cardiac notch */}
      <group
        position={[0, 0.72, -0.02]}
        ref={lungsRef}
        scale={mechanics.lungScale}
      >
        <mesh
          castShadow
          geometry={rightLung}
          position={[-0.25, 0, 0]}
          receiveShadow
        >
          <meshPhysicalMaterial
            clearcoat={0.4}
            clearcoatRoughness={0.3}
            roughness={0.42}
            vertexColors
          />
        </mesh>
        <mesh
          castShadow
          geometry={leftLung}
          position={[0.26, 0, 0]}
          receiveShadow
        >
          <meshPhysicalMaterial
            clearcoat={0.4}
            clearcoatRoughness={0.3}
            roughness={0.42}
            vertexColors
          />
        </mesh>
      </group>

      {/* Anatomical thoracic cage: spine, curved ribs, costal cartilage, sternum & intercostals */}
      <group
        position={[0, 0, 0]}
        ref={ribsRef}
        rotation={[ribPitch, 0, 0]}
        scale={[ribExpandStatic, 1, ribExpandStatic]}
      >
        {Arr.map(RIB_LEVELS, (lvl) => (
          <mesh
            castShadow
            key={`vert-${lvl.id}`}
            position={[0, lvl.y + 0.04, -lvl.spread * 0.65]}
          >
            <cylinderGeometry args={[0.056, 0.06, 0.095, 14]} />
            <SurfaceMaterial
              bump={0.35}
              color={BIOME_COLORS.boneIvory}
              roughness={0.55}
              surface="concrete"
            />
          </mesh>
        ))}
        <mesh castShadow geometry={sternum} position={[0, 0, 0.42]}>
          <SurfaceMaterial
            bump={0.3}
            color={BIOME_COLORS.boneIvory}
            roughness={0.52}
            surface="concrete"
          />
        </mesh>
        {Arr.map(ribs, (arc) => (
          <group key={arc.id}>
            <mesh castShadow geometry={arc.bone}>
              <SurfaceMaterial
                bump={0.32}
                color={BIOME_COLORS.ribIvory}
                roughness={0.48}
                surface="concrete"
              />
            </mesh>
            <mesh castShadow geometry={arc.cartilage}>
              <meshPhysicalMaterial
                clearcoat={0.55}
                color={BIOME_COLORS.cartilageBlue}
                roughness={0.28}
              />
            </mesh>
            {arc.showIntercostal ? (
              <mesh geometry={arc.intercostal}>
                <meshPhysicalMaterial
                  color={BIOME_COLORS.muscleIntercostal}
                  depthWrite={false}
                  opacity={intercostalTension}
                  roughness={0.56}
                  transparent
                />
              </mesh>
            ) : null}
          </group>
        ))}
      </group>

      {/* Delicate serous pleural cavity contour */}
      <mesh position={[0, 0.72, -0.02]} scale={[1.08, 1, 0.76]}>
        <sphereGeometry args={[0.62, 32, 24]} />
        <meshPhysicalMaterial
          clearcoat={0.85}
          clearcoatRoughness={0.1}
          color={BIOME_COLORS.pleuralMist}
          depthWrite={false}
          opacity={0.14}
          roughness={0.14}
          transparent
        />
      </mesh>

      {/* Sculpted muscular diaphragm dome with central tendon */}
      <mesh
        castShadow
        geometry={diaphragm}
        position={[0, mechanics.diaphragmY - 0.04, -0.02]}
        receiveShadow
        scale={[1, phase === "inhalation" ? 0.65 : 1.12, 1]}
      >
        <meshPhysicalMaterial
          clearcoat={0.28}
          clearcoatRoughness={0.35}
          roughness={0.5}
          side={DoubleSide}
          vertexColors
        />
      </mesh>

      {/* Labels */}
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[0.42, 1.44, 0]}
      >
        <span>{parts.trachea}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[-0.95, 0.88, 0.1]}
      >
        <span>{parts.lungs}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[0.98, 1.0, 0]}
      >
        <span>{parts.ribcage}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[0.98, 0.6, 0.2]}
      >
        <span>{parts.intercostal}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[-0.98, 0.48, 0.05]}
      >
        <span>{parts.pleuralCavity}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.14, 0.68]}
      >
        <span>{parts.diaphragm}</span>
      </ThreeLabel>
    </group>
  );
}
