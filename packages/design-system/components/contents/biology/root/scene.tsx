import { useFrame, useThree } from "@react-three/fiber";
import type { WaterDirection } from "@repo/design-system/components/contents/biology/root/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function RootCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.35] : [0, 1.25, 2.75]}
      cameraTarget={[0, 0.55, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function RootHairScene({
  direction,
  fluxSpeed,
  parts,
}: {
  readonly direction: WaterDirection;
  readonly fluxSpeed: number;
  readonly parts: Readonly<
    Record<
      | "cortex"
      | "endodermis"
      | "epidermis"
      | "rootHair"
      | "soilWater"
      | "xylem",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const waterRef = useRef<Group>(null);
  const ionRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const cortexCells = useMemo(
    () =>
      Arr.makeBy(4, (index) => ({
        id: `c-${index}`,
        x: -0.35 + index * 0.28,
      })),
    []
  );

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * fluxSpeed;
    const t = phaseRef.current % 1;
    if (waterRef.current !== null) {
      const wx = Match.value(direction).pipe(
        Match.when("intoRoot", () => -1.15 + t * 2.05),
        Match.when("outOfRoot", () => 0.65 - t * 1.8),
        Match.when("balanced", () => -0.45 + Math.sin(t * Math.PI * 2) * 0.14),
        Match.exhaustive
      );
      waterRef.current.position.set(wx, 0.62, 0.26);
    }
    if (ionRef.current !== null) {
      ionRef.current.position.set(-1.1 + t * 1.98, 0.44, 0.26);
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <RootCamera />
      {/* Soil bed on the left */}
      <mesh position={[-1.08, 0.42, 0]}>
        <boxGeometry args={[0.72, 0.64, 0.68]} />
        <meshStandardMaterial color={BOTANY_COLORS.soilDark} roughness={0.85} />
      </mesh>
      {/* Root hair tubular extension */}
      <mesh
        castShadow
        position={[-0.78, 0.56, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.07, 0.085, 0.68, 14]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.epidermisTan}
          roughness={0.55}
        />
      </mesh>
      {/* Epidermis layer */}
      <mesh castShadow position={[-0.5, 0.56, 0]}>
        <boxGeometry args={[0.16, 0.72, 0.64]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.epidermisTan}
          roughness={0.58}
        />
      </mesh>
      {/* Cortex parenchyma cells */}
      {Arr.map(cortexCells, (cell) => (
        <mesh castShadow key={cell.id} position={[cell.x, 0.56, 0]}>
          <boxGeometry args={[0.24, 0.66, 0.58]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.cortexCream}
            roughness={0.62}
          />
        </mesh>
      ))}
      {/* Endodermis ring with Casparian strip */}
      <mesh castShadow position={[0.68, 0.56, 0]}>
        <boxGeometry args={[0.14, 0.68, 0.6]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.endodermisRust}
          roughness={0.5}
        />
      </mesh>
      {/* Central xylem vessel */}
      <mesh castShadow position={[0.98, 0.56, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.74, 18]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.xylemCrimson}
          roughness={0.45}
        />
      </mesh>
      {/* Moving water droplet */}
      <group position={[-0.6, 0.62, 0.26]} ref={waterRef}>
        <mesh>
          <sphereGeometry args={[0.06, 12, 10]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.waterBlue}
            roughness={0.2}
          />
        </mesh>
      </group>
      {/* Moving mineral ion (active transport) */}
      <group position={[-0.8, 0.44, 0.26]} ref={ionRef}>
        <mesh>
          <octahedronGeometry args={[0.055, 0]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.sucroseGold}
            roughness={0.3}
          />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-1.12, 0.92, 0]}
      >
        <span>{parts.soilWater}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 0.2, 0.34]}
      >
        <span>{parts.rootHair}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.48, 1.04, 0]}
      >
        <span>{parts.epidermis}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.1, 1.04, 0]}
      >
        <span>{parts.cortex}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.66, 0.14, 0.34]}
      >
        <span>{parts.endodermis}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[1.04, 1.04, 0]}
      >
        <span>{parts.xylem}</span>
      </ThreeLabel>
    </group>
  );
}
