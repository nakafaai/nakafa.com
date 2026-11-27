import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { KnopCultureJar } from "@repo/design-system/components/contents/biology/mineral/culture";
import type { CultureSolution } from "@repo/design-system/components/contents/biology/mineral/model";
import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useCallback, useRef } from "react";
import type { Group } from "three";

const BUBBLE_OFFSETS = [0, 0.33, 0.66] as const;

function MineralCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.35] : [0, 1.32, 2.75]}
      cameraTarget={[0, 0.72, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function MineralDeficiencyScene({
  parts,
  solution,
}: {
  readonly parts: Readonly<
    Record<"airTube" | "leaf" | "root" | "solution" | "stem", string>
  >;
  readonly solution: CultureSolution;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const bubbleRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const rewind = useCallback(() => {
    phaseRef.current = 0;
  }, []);
  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || bubbleRef.current === null) {
      return;
    }
    phaseRef.current = (phaseRef.current + simulationStep(delta) * 0.9) % 1;
    Arr.forEach(bubbleRef.current.children, (child, idx) => {
      const t = (phaseRef.current + (BUBBLE_OFFSETS[idx] ?? 0)) % 1;
      child.position.set(
        0.16 + Math.sin(t * 9 + idx) * 0.015,
        0.14 + t * 0.42,
        0.05
      );
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <MineralCamera />
      <SeamlessBenchSurface radius={14} y={0} />
      <KnopCultureJar solution={solution} />

      {/* Rising aeration bubbles inside the nutrient solution */}
      <group ref={bubbleRef}>
        {Arr.map(BUBBLE_OFFSETS, (offset) => (
          <mesh key={offset} position={[0.16, 0.14 + offset * 0.42, 0.05]}>
            <sphereGeometry args={[0.02, 12, 10]} />
            <meshPhysicalMaterial
              clearcoat={1}
              color={BOTANY_COLORS.cohesionCyan}
              opacity={0.78}
              roughness={0.08}
              transparent
            />
          </mesh>
        ))}
      </group>

      {/* Non-overlapping theme-aware labels */}
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.48, 1.32, 0]}
      >
        <span>{parts.leaf}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.44, 0.96, 0]}
      >
        <span>{parts.stem}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.46, 0.58, 0.14]}
      >
        <span>{parts.root}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.46, 0.56, 0.14]}
      >
        <span>{parts.solution}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.46, 0.98, 0]}
      >
        <span>{parts.airTube}</span>
      </ThreeLabel>
    </group>
  );
}
