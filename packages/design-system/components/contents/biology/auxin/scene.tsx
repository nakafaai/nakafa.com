import { useFrame, useThree } from "@react-three/fiber";
import { evaluateAuxinBend } from "@repo/design-system/components/contents/biology/auxin/model";
import {
  ColeoptileCutaway,
  DirectionalBrassLamp,
} from "@repo/design-system/components/contents/biology/auxin/parts";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { TerracottaPot } from "@repo/design-system/components/contents/biology/seedling";
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

const AUXIN_DROPS = [0, 0.25, 0.5, 0.75] as const;

function AuxinCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.15, 1.52, 3.45] : [0.18, 1.28, 2.85]}
      cameraTarget={[0.16, 0.72, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function AuxinAgarBendScene({
  auxinLevel,
  parts,
}: {
  readonly auxinLevel: number;
  readonly parts: Readonly<
    Record<
      "agarBlock" | "auxinDot" | "coleoptile" | "litSide" | "shadedSide",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const dotsRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateAuxinBend(auxinLevel);
  const bendRad = (reading.bendDegrees * Math.PI) / 180;

  const rewind = useCallback(() => {
    phaseRef.current = 0;
    if (dotsRef.current !== null) {
      dotsRef.current.position.set(0, 0, 0);
    }
  }, []);
  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || dotsRef.current === null) {
      return;
    }
    phaseRef.current = (phaseRef.current + simulationStep(delta) * 0.55) % 1;
    Arr.forEach(dotsRef.current.children, (child, idx) => {
      const offset = AUXIN_DROPS[idx] ?? 0;
      const frac = 1 - ((phaseRef.current + offset) % 1);
      const theta = bendRad * frac * frac;
      const x = Math.sin(theta) * 0.52 * frac - 0.12;
      const y = 0.38 + frac * 0.82 * Math.cos(theta * 0.55);
      child.position.set(x, y, 0.13);
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <AuxinCamera />
      <SeamlessBenchSurface radius={14} y={0} />
      <TerracottaPot position={[0, 0, 0]} scale={1.08} />
      <ColeoptileCutaway bendRad={bendRad} />
      <DirectionalBrassLamp position={[0.98, 0, -0.08]} />

      {/* Diffusing IAA auxin molecules migrating down the shaded flank */}
      <group ref={dotsRef}>
        {Arr.map(AUXIN_DROPS, (offset) => {
          const frac = 1 - offset;
          const theta = bendRad * frac * frac;
          const x = Math.sin(theta) * 0.52 * frac - 0.12;
          const y = 0.38 + frac * 0.82 * Math.cos(theta * 0.55);
          return (
            <mesh key={offset} position={[x, y, 0.13]}>
              <sphereGeometry args={[0.028, 12, 10]} />
              <meshStandardMaterial
                color={BOTANY_COLORS.auxinDot}
                emissive={BOTANY_COLORS.agarGlow}
                emissiveIntensity={0.45}
                roughness={0.22}
              />
            </mesh>
          );
        })}
      </group>

      {/* Clean non-overlapping theme-aware labels */}
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.22, 1.38, 0]}
      >
        <span>{parts.agarBlock}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.4, 0.96, 0]}
      >
        <span>{parts.shadedSide}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.4, 0.56, 0]}
      >
        <span>{parts.auxinDot}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.38, 1.12, 0]}
      >
        <span>{parts.litSide}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.42, 0.5, 0]}
      >
        <span>{parts.coleoptile}</span>
      </ThreeLabel>
    </group>
  );
}
