import { useFrame, useThree } from "@react-three/fiber";
import type { SpecialNutritionMode } from "@repo/design-system/components/contents/biology/carnivore/model";
import { evaluateSpecialNutrition } from "@repo/design-system/components/contents/biology/carnivore/model";
import { useCarnivoreGeometries } from "@repo/design-system/components/contents/biology/carnivore/specimens";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
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
import { DoubleSide } from "three";

const HAUSTORIA_OFFSETS = [
  { id: "h1", rotZ: Math.PI / 2, x: 0.14, y: 0.42, z: 0.08 },
  { id: "h2", rotZ: Math.PI / 2, x: 0.14, y: 0.72, z: 0.08 },
] as const;

function CarnivoreCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.35] : [0, 1.25, 2.75]}
      cameraTarget={[0, 0.62, 0]}
      fov={38}
      maxDistance={5.6}
      minDistance={1.4}
    />
  );
}

/** Sculpted tiny flying prey insect (segmented body + iridescent translucent wings). */
function PreyInsect() {
  return (
    <group>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.024, 0.068, 8, 12]} />
        <meshPhysicalMaterial
          clearcoat={0.65}
          color={BOTANY_COLORS.insectDark}
          roughness={0.32}
        />
      </mesh>
      <mesh position={[0.048, 0.01, 0]}>
        <sphereGeometry args={[0.02, 10, 8]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.insectDark}
          roughness={0.3}
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          key={`iw-${side}`}
          position={[0.005, 0.025, side * 0.045]}
          rotation={[side * 0.55, 0, 0]}
          scale={[1.4, 0.15, 0.65]}
        >
          <sphereGeometry args={[0.045, 10, 8]} />
          <meshPhysicalMaterial
            clearcoat={0.85}
            color={BOTANY_COLORS.glassJar}
            opacity={0.55}
            roughness={0.14}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

export function CarnivorousPlantScene({
  mode,
  parts,
}: {
  readonly mode: SpecialNutritionMode;
  readonly parts: Readonly<
    Record<
      "aerialRoot" | "haustorium" | "hostStem" | "insect" | "trapLeaf",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const insectRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const profile = evaluateSpecialNutrition(mode);
  const geos = useCarnivoreGeometries();

  useVisualStop(() => {
    phaseRef.current = 0;
    if (insectRef.current !== null) {
      insectRef.current.position.set(0.08, 0.96, 0.06);
    }
  });

  useFrame((_, delta) => {
    if (!playing || insectRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.4;
    const t = phaseRef.current % 1;
    insectRef.current.position.set(
      0.06 + Math.sin(t * Math.PI * 2) * 0.1,
      1.04 - t * 0.54,
      0.06
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <CarnivoreCamera />

      {profile.trapsInsects ? (
        <group>
          {/* Sculpted hourglass Nepenthes pitcher leaf + ribbed peristome + lid + tendril */}
          <mesh
            castShadow
            geometry={geos.pitcher}
            position={[0, 0.14, 0]}
            receiveShadow
          >
            <meshPhysicalMaterial
              clearcoat={0.55}
              clearcoatRoughness={0.26}
              roughness={0.38}
              side={DoubleSide}
              vertexColors
            />
          </mesh>
          {/* Flared ribbed waxy peristome collar */}
          <mesh
            castShadow
            position={[0, 0.96, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.205, 0.038, 18, 40]} />
            <meshPhysicalMaterial
              clearcoat={0.78}
              clearcoatRoughness={0.14}
              color={BOTANY_COLORS.carnivorePitcher}
              roughness={0.24}
            />
          </mesh>
          {/* Refractive digestive enzyme pool cleanly tucked inside lower belly */}
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.145, 0.105, 0.2, 24]} />
            <meshPhysicalMaterial
              clearcoat={0.9}
              color={BOTANY_COLORS.waterBlue}
              depthWrite={false}
              opacity={0.52}
              roughness={0.12}
              transparent
            />
          </mesh>
          {/* Arching heart-shaped operculum lid hinged to posterior peristome */}
          <mesh castShadow geometry={geos.lidHinge}>
            <meshStandardMaterial
              color={BOTANY_COLORS.sepalGreen}
              roughness={0.5}
            />
          </mesh>
          <mesh
            castShadow
            geometry={geos.lid}
            position={[0, 1.09, -0.17]}
            rotation={[-0.24, 0, 0]}
          >
            <meshPhysicalMaterial
              clearcoat={0.48}
              color={BOTANY_COLORS.healthyLeaf}
              roughness={0.38}
            />
          </mesh>
          <mesh castShadow geometry={geos.tendril} position={[0, 0.14, 0]}>
            <meshStandardMaterial
              color={BOTANY_COLORS.sepalGreen}
              roughness={0.56}
            />
          </mesh>
          {/* Sculpted prey insect hovering right above peristome */}
          <group position={[0.18, 1.06, 0.12]} ref={insectRef} scale={1.35}>
            <PreyInsect />
          </group>
          <ThreeLabel
            color={ink}
            fontSize="compact"
            position={[-0.72, 0.64, 0]}
          >
            <span>{parts.trapLeaf}</span>
          </ThreeLabel>
          <ThreeLabel color={ink} fontSize="compact" position={[0.64, 1.0, 0]}>
            <span>{parts.insect}</span>
          </ThreeLabel>
        </group>
      ) : null}

      {profile.tapsHostVascular ? (
        <group>
          {/* Woody textured green host stem */}
          <mesh castShadow position={[0, 0.58, 0]} receiveShadow>
            <cylinderGeometry args={[0.14, 0.16, 1.14, 28]} />
            <SurfaceMaterial
              bump={0.55}
              color={BOTANY_COLORS.stemGreen}
              repeat={[2, 3]}
              roughness={0.62}
              surface="bark"
            />
          </mesh>
          {/* Multi-turn helical golden-orange dodder parasite vine */}
          <mesh castShadow geometry={geos.dodderHelix}>
            <meshPhysicalMaterial
              clearcoat={0.42}
              color={BOTANY_COLORS.dodderOrange}
              roughness={0.4}
            />
          </mesh>
          {/* Penetrating vascular-tapping haustoria pegs */}
          {Arr.map(HAUSTORIA_OFFSETS, (h) => (
            <mesh
              castShadow
              key={h.id}
              position={[h.x, h.y, h.z]}
              rotation={[0, 0, h.rotZ]}
            >
              <coneGeometry args={[0.045, 0.22, 16]} />
              <meshPhysicalMaterial
                clearcoat={0.38}
                color={BOTANY_COLORS.dodderOrange}
                roughness={0.38}
              />
            </mesh>
          ))}
          <ThreeLabel
            color={ink}
            fontSize="compact"
            position={[-0.72, 0.86, 0]}
          >
            <span>{parts.hostStem}</span>
          </ThreeLabel>
          <ThreeLabel color={ink} fontSize="compact" position={[0.72, 0.56, 0]}>
            <span>{parts.haustorium}</span>
          </ThreeLabel>
        </group>
      ) : null}

      {profile.hasChlorophyll && !profile.trapsInsects ? (
        <group>
          {/* Gnarled mossy tree bark branch */}
          <mesh castShadow geometry={geos.branch} receiveShadow>
            <SurfaceMaterial
              bump={0.9}
              color={BOTANY_COLORS.barkBrown}
              repeat={[3, 1]}
              roughness={0.88}
              surface="bark"
            />
          </mesh>
          {/* Lush epiphytic orchid strap-leaf rosette */}
          <mesh castShadow geometry={geos.orchidRosette} receiveShadow>
            <meshPhysicalMaterial
              clearcoat={0.44}
              clearcoatRoughness={0.28}
              roughness={0.4}
              side={DoubleSide}
              vertexColors
            />
          </mesh>
          {/* Delicate purple-pink orchid bloom perched above rosette */}
          <mesh
            castShadow
            position={[0.06, 0.86, 0.04]}
            scale={[1.1, 0.8, 0.4]}
          >
            <sphereGeometry args={[0.075, 16, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.32}
              color={BOTANY_COLORS.flowerPurple}
              roughness={0.42}
            />
          </mesh>
          {/* Draping curved spongy velamen aerial roots */}
          {Arr.map(geos.aerialRootCurves, (strand) => (
            <mesh castShadow geometry={strand.geo} key={strand.id}>
              <meshPhysicalMaterial
                clearcoat={0.22}
                color={BOTANY_COLORS.orchidRoot}
                roughness={0.62}
              />
            </mesh>
          ))}
          <ThreeLabel
            color={ink}
            fontSize="compact"
            position={[-0.76, 0.56, 0]}
          >
            <span>{parts.hostStem}</span>
          </ThreeLabel>
          <ThreeLabel color={ink} fontSize="compact" position={[0.72, 0.18, 0]}>
            <span>{parts.aerialRoot}</span>
          </ThreeLabel>
        </group>
      ) : null}
    </group>
  );
}
