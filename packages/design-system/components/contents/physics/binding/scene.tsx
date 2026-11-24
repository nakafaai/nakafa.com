import { useFrame, useThree } from "@react-three/fiber";
import type {
  NuclearProcess,
  NuclideId,
} from "@repo/design-system/components/contents/physics/binding/model";
import { nuclideSpec } from "@repo/design-system/components/contents/physics/binding/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function BindingCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.2] : [0, 1.25, 2.5]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.3}
    />
  );
}

export function NuclearBindingScene({
  nuclide,
  parts,
  process,
}: {
  readonly nuclide: NuclideId;
  readonly parts: Readonly<
    Record<
      "fissionZone" | "fusionZone" | "ironPeak" | "neutron" | "proton",
      string
    >
  >;
  readonly process: NuclearProcess;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const clusterRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const spec = nuclideSpec(nuclide);
  const displayCount = Math.min(28, spec.massNumber);

  const nucleons = useMemo(
    () =>
      Arr.makeBy(displayCount, (index) => {
        const phi = Math.acos(1 - (2 * (index + 0.5)) / displayCount);
        const theta = Math.PI * (1 + Math.sqrt(5)) * index;
        const radius = displayCount <= 4 ? 0.14 : 0.24 + displayCount * 0.008;
        return {
          id: `n-${index}`,
          isProton: index % 2 === 0,
          x: radius * Math.sin(phi) * Math.cos(theta),
          y: radius * Math.cos(phi),
          z: radius * Math.sin(phi) * Math.sin(theta),
        };
      }),
    [displayCount]
  );

  useFrame((_, delta) => {
    if (!playing || clusterRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.9;
    clusterRef.current.rotation.y = phaseRef.current;
    const split =
      process === "fission" ? Math.sin(phaseRef.current * 2) * 0.04 : 0;
    clusterRef.current.scale.set(1 + split, 1, 1);
  });

  const zoneText =
    nuclide === "iron56"
      ? parts.ironPeak
      : parts[process === "fusion" ? "fusionZone" : "fissionZone"];

  return (
    <group>
      <SimulationTicker running={playing} />
      <BindingCamera />
      <group position={[0, 0.56, 0]} ref={clusterRef}>
        {Arr.map(nucleons, (item) => (
          <mesh castShadow key={item.id} position={[item.x, item.y, item.z]}>
            <sphereGeometry args={[0.11, 14, 12]} />
            <meshStandardMaterial
              color={
                item.isProton ? QUANTUM_COLORS.proton : QUANTUM_COLORS.neutron
              }
              roughness={0.38}
            />
          </mesh>
        ))}
      </group>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 0.86, 0]}
      >
        <span>{parts.proton}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0.78, 0.86, 0]}
      >
        <span>{parts.neutron}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.12, 0]}
      >
        <span>{zoneText}</span>
      </ThreeLabel>
    </group>
  );
}
