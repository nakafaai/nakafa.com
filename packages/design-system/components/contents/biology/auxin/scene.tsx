import { useFrame } from "@react-three/fiber";
import { evaluateAuxinBend } from "@repo/design-system/components/contents/biology/auxin/model";
import {
  ColeoptileCutaway,
  DirectionalBrassLamp,
} from "@repo/design-system/components/contents/biology/auxin/parts";
import { Leader } from "@repo/design-system/components/contents/biology/leader";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Pot } from "@repo/design-system/components/three/flora/pot";
import { Turn } from "@repo/design-system/components/three/form/part";
import { Matter } from "@repo/design-system/components/three/matter/material";
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

/** One auxin marker, a bead turned from its half outline. */
const BEAD = Arr.makeBy(9, (step) => {
  const angle = (step / 8) * Math.PI;
  return [0.011 * Math.sin(angle), -0.011 * Math.cos(angle)] as const;
});

/** Where on the shoot `share` of the way up it lies, at the middle of its girth, when it is bent `bendRad`. */
function shootAt(bendRad: number, share: number) {
  const turned = bendRad * share * share;
  return [
    Math.sin(turned) * 0.52 * share,
    0.3 + share * 0.94 * Math.cos(turned * 0.55),
  ] as const;
}

/** Where an auxin marker is `frac` of the way down the shaded flank, from the tip. */
function markerAt(bendRad: number, frac: number) {
  const theta = bendRad * frac * frac;
  return [
    Math.sin(theta) * 0.52 * frac - 0.055,
    0.32 + frac * 0.9 * Math.cos(theta * 0.55),
  ] as const;
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
  const dotsRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateAuxinBend(auxinLevel);
  const bendRad = (reading.bendDegrees * Math.PI) / 180;
  const top = shootAt(bendRad, 1);
  const middle = shootAt(bendRad, 0.6);
  const dot = markerAt(bendRad, 0.35);

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
      const [x, y] = markerAt(bendRad, 1 - ((phaseRef.current + offset) % 1));
      child.position.set(x, y, 0.075);
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <AuxinCamera />
      <CameraBounds bounds={SUBJECT}>
        <group scale={1.08}>
          <Pot />
        </group>
        <DirectionalBrassLamp position={[0.98, 0, -0.08]} />
        <ColeoptileCutaway
          bendRad={bendRad}
          skew={((reading.elongationPercent - 100) / 65) * 0.42}
        />

        {/* Diffusing IAA auxin molecules migrating down the shaded flank */}
        <group ref={dotsRef}>
          {Arr.map(AUXIN_DROPS, (offset) => {
            const [x, y] = markerAt(bendRad, 1 - offset);
            return (
              <mesh key={offset} position={[x, y, 0.075]}>
                <Turn profile={BEAD} />
                <Matter color={BOTANY_COLORS.auxinDot} glow={0.7} of="light" />
              </mesh>
            );
          })}
        </group>
      </CameraBounds>

      <Leader
        anchorY="bottom"
        at={[top[0] - 0.12, top[1] + 0.24, 0]}
        to={[top[0] - 0.05, top[1] + 0.08, 0.06]}
      >
        <span>{parts.agarBlock}</span>
      </Leader>
      <Leader
        anchorX="right"
        at={[middle[0] - 0.32, middle[1] + 0.04, 0]}
        to={[middle[0] - 0.11, middle[1], 0.04]}
      >
        <span>{parts.shadedSide}</span>
      </Leader>
      <Leader
        anchorX="right"
        at={[dot[0] - 0.3, dot[1] - 0.06, 0]}
        to={[dot[0] - 0.014, dot[1], 0.075]}
      >
        <span>{parts.auxinDot}</span>
      </Leader>
      <Leader
        anchorX="left"
        at={[middle[0] + 0.32, middle[1] + 0.04, 0]}
        to={[middle[0] + 0.11, middle[1], 0.04]}
      >
        <span>{parts.litSide}</span>
      </Leader>
      <Leader anchorX="left" at={[0.3, 0.52, 0]} to={[0.1, 0.48, 0.06]}>
        <span>{parts.coleoptile}</span>
      </Leader>
    </group>
  );
}
