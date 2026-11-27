import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { RingMode } from "@repo/design-system/components/contents/biology/phloem/model";
import { evaluatePhloemFlow } from "@repo/design-system/components/contents/biology/phloem/model";
import { PhloemVascularBundle } from "@repo/design-system/components/contents/biology/phloem/vascular";
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

const SUCROSE_DROPS = [0, 0.25, 0.5, 0.75] as const;

function PhloemCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.4] : [0, 1.32, 2.8]}
      cameraTarget={[0, 0.68, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function PhloemTranslocationScene({
  mode,
  parts,
  sourceSucrose,
}: {
  readonly mode: RingMode;
  readonly parts: Readonly<
    Record<
      "companionCell" | "sievePlate" | "sieveTube" | "sucrose" | "xylem",
      string
    >
  >;
  readonly sourceSucrose: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const sucroseRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const flow = evaluatePhloemFlow(mode, sourceSucrose);

  const rewind = useCallback(() => {
    phaseRef.current = 0;
  }, []);
  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || sucroseRef.current === null) {
      return;
    }
    phaseRef.current =
      (phaseRef.current + simulationStep(delta) * flow.flowRate * 0.6) % 1;
    Arr.forEach(sucroseRef.current.children, (child, idx) => {
      const t = (phaseRef.current + (SUCROSE_DROPS[idx] ?? 0)) % 1;
      const y = mode === "ringed" ? 1.16 - t * 0.4 : 1.16 - t * 0.96;
      child.position.set(Math.sin(t * 10 + idx) * 0.035, y, 0.08);
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <PhloemCamera />
      <PhloemVascularBundle bulgeScale={flow.bulgeScale} mode={mode} />

      {/* Flowing translucent golden sucrose-solution droplets */}
      <group ref={sucroseRef}>
        {Arr.map(SUCROSE_DROPS, (offset) => {
          const y =
            mode === "ringed" ? 1.16 - offset * 0.4 : 1.16 - offset * 0.96;
          return (
            <mesh key={offset} position={[0, y, 0.08]}>
              <sphereGeometry args={[0.038, 14, 12]} />
              <meshPhysicalMaterial
                clearcoat={0.9}
                color={BOTANY_COLORS.sucroseGold}
                emissive={BOTANY_COLORS.agarGlow}
                emissiveIntensity={0.28}
                opacity={0.9}
                roughness={0.14}
                transparent
              />
            </mesh>
          );
        })}
      </group>

      {/* Non-overlapping theme-aware labels */}
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.64, 1.02, 0]}
      >
        <span>{parts.xylem}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.08, 1.38, 0]}>
        <span>{parts.sieveTube}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.62, 0.68, 0.08]}
      >
        <span>{parts.sievePlate}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.54, 0.94, 0]}
      >
        <span>{parts.companionCell}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.52, 0.44, 0.08]}
      >
        <span>{parts.sucrose}</span>
      </ThreeLabel>
    </group>
  );
}
