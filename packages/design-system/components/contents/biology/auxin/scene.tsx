import { useFrame, useThree } from "@react-three/fiber";
import { evaluateAuxinBend } from "@repo/design-system/components/contents/biology/auxin/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function AuxinCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.48, 3.2] : [0, 1.28, 2.6]}
      cameraTarget={[0, 0.62, 0]}
      fov={38}
      maxDistance={5.5}
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
  const dotsRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateAuxinBend(auxinLevel);
  const bendRad = (reading.bendDegrees * Math.PI) / 180;

  const segments = useMemo(
    () =>
      Arr.makeBy(5, (index) => ({
        id: `seg-${index}`,
        index,
      })),
    []
  );

  useFrame((_, delta) => {
    if (!playing || dotsRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.1;
    const t = phaseRef.current % 1;
    dotsRef.current.position.set(-0.14, 1.05 - t * 0.72, 0.16);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <AuxinCamera />
      {/* Soil base */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.45, 0.48, 0.16, 20]} />
        <meshStandardMaterial color={BOTANY_COLORS.soilDark} roughness={0.85} />
      </mesh>
      {/* Articulated bending coleoptile */}
      {Arr.map(segments, (seg) => {
        const frac = (seg.index + 0.5) / 5;
        const angle = -bendRad * frac;
        const x = Math.sin(bendRad * frac * 0.7) * 0.45 * frac;
        const y = 0.22 + frac * 0.86;
        return (
          <mesh
            castShadow
            key={seg.id}
            position={[x, y, 0]}
            rotation={[0, 0, angle]}
          >
            <cylinderGeometry args={[0.11, 0.12, 0.2, 16]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.healthyLeaf}
              roughness={0.5}
            />
          </mesh>
        );
      })}
      {/* Off-centre auxin agar block placed on left (shaded) side */}
      <mesh
        castShadow
        position={[
          Math.sin(bendRad * 0.7) * 0.45 - 0.07,
          1.12 - Math.sin(bendRad) * 0.08,
          0,
        ]}
        rotation={[0, 0, -bendRad]}
      >
        <boxGeometry args={[0.16, 0.12, 0.16]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.agarAmber}
          opacity={0.82}
          roughness={0.25}
          transparent
        />
      </mesh>
      {/* Diffusing auxin molecules along shaded side */}
      <group position={[-0.14, 0.8, 0.16]} ref={dotsRef}>
        <mesh>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.auxinDot}
            roughness={0.3}
          />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.64, 1.18, 0]}
      >
        <span>{parts.agarBlock}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.68, 0.78, 0]}
      >
        <span>{parts.shadedSide}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, 0.78, 0]}
      >
        <span>{parts.litSide}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.66, 0.42, 0]}
      >
        <span>{parts.coleoptile}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.62, 0.36, 0]}
      >
        <span>{parts.auxinDot}</span>
      </ThreeLabel>
    </group>
  );
}
