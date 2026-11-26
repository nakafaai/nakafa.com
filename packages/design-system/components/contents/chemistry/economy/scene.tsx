import { useFrame, useThree } from "@react-three/fiber";
import type { SynthesisRoute } from "@repo/design-system/components/contents/chemistry/economy/model";
import { evaluateAtomEconomy } from "@repo/design-system/components/contents/chemistry/economy/model";
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

function EconomyCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.45] : [0, 1.32, 2.8]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function AtomEconomyScene({
  parts,
  route,
}: {
  readonly parts: Readonly<
    Record<
      "byproductWaste" | "desiredProduct" | "reactantFeed" | "reactorChamber",
      string
    >
  >;
  readonly route: SynthesisRoute;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const feedRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateAtomEconomy(route);

  const products = useMemo(
    () =>
      Arr.makeBy(reading.productSpheres, (index) => ({
        id: `p-${index}`,
        x: 0.62 + (index % 3) * 0.15,
        y: 0.62 + Math.floor(index / 3) * 0.14,
      })),
    [reading.productSpheres]
  );

  const wastes = useMemo(
    () =>
      Arr.makeBy(reading.wasteSpheres, (index) => ({
        id: `w-${index}`,
        x: 0.64 + (index % 2) * 0.16,
        y: 0.18 + Math.floor(index / 2) * 0.14,
      })),
    [reading.wasteSpheres]
  );

  useFrame((_, delta) => {
    if (!playing || feedRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.2;
    const t = phaseRef.current % 1;
    feedRef.current.position.set(-1.05 + t * 0.85, 0.56, 0);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <EconomyCamera />
      {/* Feed pipe */}
      <mesh position={[-0.78, 0.56, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.72, 14]} />
        <meshStandardMaterial color={PROCESS_COLORS.alloySteel} />
      </mesh>
      {/* Moving reactant cluster */}
      <group position={[-0.85, 0.56, 0]} ref={feedRef}>
        <mesh>
          <sphereGeometry args={[0.065, 12, 10]} />
          <meshStandardMaterial color={PROCESS_COLORS.ammoniaCyan} />
        </mesh>
      </group>
      {/* Central synthesis reactor chamber */}
      <mesh castShadow position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.72, 22]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.catalystTeal}
          opacity={0.78}
          roughness={0.35}
          transparent
        />
      </mesh>
      {/* Desired product spheres (upper stream) */}
      {Arr.map(products, (atom) => (
        <mesh castShadow key={atom.id} position={[atom.x, atom.y, 0]}>
          <sphereGeometry args={[0.06, 12, 10]} />
          <meshStandardMaterial color={PROCESS_COLORS.greenProduct} />
        </mesh>
      ))}
      {/* Byproduct waste spheres (lower bin) */}
      {Arr.map(wastes, (atom) => (
        <mesh castShadow key={atom.id} position={[atom.x, atom.y, 0]}>
          <dodecahedronGeometry args={[0.056, 0]} />
          <meshStandardMaterial color={PROCESS_COLORS.wasteSlate} />
        </mesh>
      ))}
      {/* Labels */}
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.92, 0.82, 0]}
      >
        <span>{parts.reactantFeed}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.06, 0]}
      >
        <span>{parts.reactorChamber}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, 1.02, 0]}
      >
        <span>{parts.desiredProduct}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, 0.14, 0.24]}
      >
        <span>{parts.byproductWaste}</span>
      </ThreeLabel>
    </group>
  );
}
