import { useFrame, useThree } from "@react-three/fiber";
import type { TransportMode } from "@repo/design-system/components/contents/biology/pump/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function PumpCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.75, 3.45] : [0, 1.4, 2.8]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.4}
    />
  );
}

export function MembranePumpScene({
  mode,
  parts,
}: {
  readonly mode: TransportMode;
  readonly parts: Readonly<
    Record<
      "adp" | "atp" | "bilayer" | "carrierPump" | "channelProtein" | "solute",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const solutesRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const heads = useMemo(
    () =>
      Arr.makeBy(10, (index) => ({
        id: `h-${index}`,
        x: -1.12 + index * 0.25,
      })),
    []
  );

  useFrame((_, delta) => {
    if (!playing || solutesRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.4;
    const t = phaseRef.current % 1;
    const y = mode === "activePump" ? 0.14 + t * 0.88 : 1.02 - t * 0.88;
    const x = Match.value(mode).pipe(
      Match.when("simpleDiffusion", () => -0.68),
      Match.when("facilitated", () => 0),
      Match.when("activePump", () => 0.66),
      Match.exhaustive
    );
    solutesRef.current.position.set(x, y, 0.14);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <PumpCamera />
      {/* Phospholipid bilayer rows */}
      {Arr.map(heads, (head) => (
        <group key={head.id} position={[head.x, 0.56, 0]}>
          <mesh position={[0, 0.16, 0]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial
              color={HOMEOSTASIS_COLORS.bilayerHead}
              roughness={0.45}
            />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial
              color={HOMEOSTASIS_COLORS.bilayerHead}
              roughness={0.45}
            />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.02, 0.02, 0.26, 8]} />
            <meshStandardMaterial
              color={HOMEOSTASIS_COLORS.bilayerTail}
              roughness={0.6}
            />
          </mesh>
        </group>
      ))}
      {/* Channel protein (center) */}
      <mesh castShadow position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.52, 20, 1, true]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.channelProtein}
          opacity={mode === "facilitated" ? 0.95 : 0.5}
          roughness={0.4}
          side={2}
          transparent
        />
      </mesh>
      {/* ATP-driven carrier pump (right) */}
      <mesh castShadow position={[0.66, 0.56, 0]}>
        <cylinderGeometry args={[0.2, 0.14, 0.56, 16]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.carrierPump}
          opacity={mode === "activePump" ? 0.96 : 0.48}
          roughness={0.4}
          transparent
        />
      </mesh>
      {/* ATP & ADP markers beneath pump */}
      <mesh position={[0.52, 0.22, 0.24]}>
        <octahedronGeometry args={[0.075, 0]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.atp}
          opacity={mode === "activePump" ? 1 : 0.35}
          roughness={0.3}
          transparent
        />
      </mesh>
      <mesh position={[0.84, 0.22, 0.24]}>
        <octahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.adp}
          opacity={mode === "activePump" ? 1 : 0.35}
          roughness={0.45}
          transparent
        />
      </mesh>
      {/* Crossing solute */}
      <group position={[0, 0.85, 0.14]} ref={solutesRef}>
        <mesh castShadow>
          <sphereGeometry args={[0.068, 14, 12]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.solute}
            roughness={0.32}
          />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.92, 0.92, 0]}
      >
        <span>{parts.bilayer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.02, 0]}
      >
        <span>
          {parts.channelProtein} / {parts.solute}
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0.72, 1.02, 0]}
      >
        <span>{parts.carrierPump}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0.72, 0.08, 0.34]}
      >
        <span>
          {parts.atp} -&gt; {parts.adp}
        </span>
      </ThreeLabel>
    </group>
  );
}
