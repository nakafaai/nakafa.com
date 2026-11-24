import { useFrame, useThree } from "@react-three/fiber";
import type {
  CatalystState,
  ReactionEnthalpy,
} from "@repo/design-system/components/contents/chemistry/catalyst/model";
import { evaluateCatalyst } from "@repo/design-system/components/contents/chemistry/catalyst/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { KINETICS_COLORS } from "@repo/design-system/lib/material/kinetics";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Mesh } from "three";

function archY(t: number, startY: number, peakY: number, endY: number): number {
  const base = startY * (1 - t) + endY * t;
  const bump = Math.sin(Math.PI * t) ** 2 * (peakY - (startY + endY) / 2);
  return base + bump;
}

function CatalystCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.55] : [0, 1.25, 2.85]}
      cameraTarget={[0, 0.66, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.4}
    />
  );
}

export function CatalystPathwayScene({
  catalyst,
  parts,
  reaction,
}: {
  readonly catalyst: CatalystState;
  readonly parts: Readonly<
    Record<
      | "catalysedPeak"
      | "catalystSurface"
      | "productLevel"
      | "reactantLevel"
      | "uncatalysedPeak",
      string
    >
  >;
  readonly reaction: ReactionEnthalpy;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const travelerRef = useRef<Mesh>(null);
  const tRef = useRef(0.2);
  const profile = evaluateCatalyst(reaction, catalyst);

  const uncatalysedNodes = useMemo(
    () =>
      Arr.makeBy(17, (index) => {
        const t = index / 16;
        return {
          id: `u-${index}`,
          x: -1.1 + t * 2.2,
          y: archY(
            t,
            profile.reactantHeight,
            profile.uncatalysedPeakHeight,
            profile.productHeight
          ),
        };
      }),
    [profile]
  );

  const catalysedNodes = useMemo(
    () =>
      Arr.makeBy(17, (index) => {
        const t = index / 16;
        return {
          id: `c-${index}`,
          x: -1.1 + t * 2.2,
          y: archY(
            t,
            profile.reactantHeight,
            profile.catalysedPeakHeight,
            profile.productHeight
          ),
        };
      }),
    [profile]
  );

  useFrame((_, delta) => {
    const ball = travelerRef.current;
    if (ball === null) {
      return;
    }
    if (playing) {
      const rate = catalyst === "present" ? 0.52 : 0.28;
      tRef.current = (tRef.current + simulationStep(delta) * rate) % 1;
    }
    const peak =
      catalyst === "present"
        ? profile.catalysedPeakHeight
        : profile.uncatalysedPeakHeight;
    ball.position.set(
      -1.1 + tRef.current * 2.2,
      archY(tRef.current, profile.reactantHeight, peak, profile.productHeight),
      catalyst === "present" ? 0.16 : -0.16
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <CatalystCamera />
      {/* Catalyst metallic plate surface */}
      <mesh position={[0, 0.08, 0.16]} receiveShadow>
        <boxGeometry args={[1.1, 0.12, 0.42]} />
        <meshStandardMaterial
          color={KINETICS_COLORS.catalystSurface}
          opacity={catalyst === "present" ? 0.96 : 0.25}
          roughness={0.45}
          transparent={catalyst !== "present"}
        />
      </mesh>
      {/* Reactant and product energy level ledges */}
      <mesh castShadow position={[-1.12, profile.reactantHeight / 2, 0]}>
        <boxGeometry args={[0.38, profile.reactantHeight, 0.5]} />
        <meshStandardMaterial
          color={KINETICS_COLORS.reactant}
          opacity={0.75}
          roughness={0.48}
          transparent
        />
      </mesh>
      <mesh castShadow position={[1.12, profile.productHeight / 2, 0]}>
        <boxGeometry args={[0.38, profile.productHeight, 0.5]} />
        <meshStandardMaterial
          color={KINETICS_COLORS.product}
          opacity={0.75}
          roughness={0.48}
          transparent
        />
      </mesh>
      {/* Uncatalysed energy barrier beads */}
      {Arr.map(uncatalysedNodes, (node) => (
        <mesh key={node.id} position={[node.x, node.y, -0.16]}>
          <sphereGeometry args={[0.042, 10, 8]} />
          <meshStandardMaterial
            color={KINETICS_COLORS.uncatalysedPath}
            opacity={catalyst === "absent" ? 0.96 : 0.4}
            roughness={0.4}
            transparent
          />
        </mesh>
      ))}
      {/* Catalysed lower-barrier beads */}
      {Arr.map(catalysedNodes, (node) => (
        <mesh key={node.id} position={[node.x, node.y, 0.16]}>
          <sphereGeometry args={[0.045, 10, 8]} />
          <meshStandardMaterial
            color={KINETICS_COLORS.catalysedPath}
            opacity={catalyst === "present" ? 0.98 : 0.35}
            roughness={0.35}
            transparent
          />
        </mesh>
      ))}
      {/* Progressing reaction-complex sphere */}
      <mesh
        castShadow
        position={[-0.6, profile.reactantHeight, 0]}
        ref={travelerRef}
      >
        <sphereGeometry args={[0.082, 14, 12]} />
        <meshStandardMaterial
          color={KINETICS_COLORS.activationLine}
          roughness={0.3}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={KINETICS_COLORS.labelInk}
        fontSize="compact"
        position={[-1.12, profile.reactantHeight + 0.24, 0]}
      >
        <span>{parts.reactantLevel}</span>
      </ThreeLabel>
      <ThreeLabel
        color={KINETICS_COLORS.labelInk}
        fontSize="compact"
        position={[1.12, profile.productHeight + 0.24, 0]}
      >
        <span>{parts.productLevel}</span>
      </ThreeLabel>
      <ThreeLabel
        color={KINETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0, profile.uncatalysedPeakHeight + 0.22, -0.16]}
      >
        <span>{parts.uncatalysedPeak}</span>
      </ThreeLabel>
      <ThreeLabel
        color={KINETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0, profile.catalysedPeakHeight + 0.16, 0.24]}
      >
        <span>{parts.catalysedPeak}</span>
      </ThreeLabel>
      <ThreeLabel
        color={KINETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.16, 0.48]}
      >
        <span>{parts.catalystSurface}</span>
      </ThreeLabel>
    </group>
  );
}
