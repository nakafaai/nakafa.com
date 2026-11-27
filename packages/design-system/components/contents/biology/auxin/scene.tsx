import { useFrame, useThree } from "@react-three/fiber";
import { evaluateAuxinBend } from "@repo/design-system/components/contents/biology/auxin/model";
import {
  ColeoptileCutaway,
  DirectionalBrassLamp,
} from "@repo/design-system/components/contents/biology/auxin/parts";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { TerracottaPot } from "@repo/design-system/components/contents/biology/seedling";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
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

/** Where along its way down the shaded flank each auxin marker starts, as a share of the way. */
const AUXIN_DROPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] as const;

/** What the lab shows, for the camera to fill the frame with: the pot, the shoot at its greatest bend and the lamp. */
const SUBJECT = {
  x: { max: 1.15, min: -0.42 },
  y: { max: 1.45, min: 0 },
  z: { max: 0.05, min: -0.05 },
} as const;

/** Whether the lab is shown on a narrow screen, where a label that would touch its subject is left out. */
function useNarrow() {
  return isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
}

function AuxinCamera() {
  return (
    <CameraControls
      cameraPosition={[0.18, 1.28, 2.85]}
      cameraTarget={[0.16, 0.72, 0]}
      fov={38}
      framing="content"
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
  const narrow = useNarrow();
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
      const x = Math.sin(theta) * 0.52 * frac - 0.055;
      const y = 0.32 + frac * 0.9 * Math.cos(theta * 0.55);
      child.position.set(x, y, 0.075);
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <AuxinCamera />
      <CameraBounds bounds={SUBJECT}>
        <TerracottaPot position={[0, 0, 0]} scale={1.08} />
        <DirectionalBrassLamp position={[0.98, 0, -0.08]} />
        <ColeoptileCutaway
          bendRad={bendRad}
          skew={((reading.elongationPercent - 100) / 65) * 0.42}
        />

        {/* Diffusing IAA auxin molecules migrating down the shaded flank */}
        <group ref={dotsRef}>
          {Arr.map(AUXIN_DROPS, (offset) => {
            const frac = 1 - offset;
            const theta = bendRad * frac * frac;
            const x = Math.sin(theta) * 0.52 * frac - 0.055;
            const y = 0.32 + frac * 0.9 * Math.cos(theta * 0.55);
            return (
              <mesh key={offset} position={[x, y, 0.075]}>
                <icosahedronGeometry args={[0.011, 2]} />
                <meshStandardMaterial
                  color={BOTANY_COLORS.auxinDot}
                  emissive={BOTANY_COLORS.agarGlow}
                  emissiveIntensity={1.4}
                  roughness={0.22}
                />
              </mesh>
            );
          })}
        </group>
      </CameraBounds>

      {/* Clean non-overlapping theme-aware labels */}
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.22, 1.38, 0]}
        visible={!narrow}
      >
        <span>{parts.agarBlock}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.4, 0.96, 0]}
        visible={!narrow}
      >
        <span>{parts.shadedSide}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.4, 0.56, 0]}
        visible={!narrow}
      >
        <span>{parts.auxinDot}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.42, 0.9, 0]}
      >
        <span>{parts.litSide}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.46, 0.44, 0]}
        visible={!narrow}
      >
        <span>{parts.coleoptile}</span>
      </ThreeLabel>
    </group>
  );
}
