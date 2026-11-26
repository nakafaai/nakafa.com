import { useFrame, useThree } from "@react-three/fiber";
import type { CondensationPolymer } from "@repo/design-system/components/contents/chemistry/nylon/model";
import { evaluateCondensationPolymer } from "@repo/design-system/components/contents/chemistry/nylon/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function NylonCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.45] : [0, 1.28, 2.8]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function CondensationNylonScene({
  parts,
  polymer,
}: {
  readonly parts: Readonly<
    Record<
      | "esterOrAmideLink"
      | "monomerA"
      | "monomerB"
      | "polymerChain"
      | "waterByproduct",
      string
    >
  >;
  readonly polymer: CondensationPolymer;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const waterRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const profile = evaluateCondensationPolymer(polymer);

  const blocks = useMemo(
    () =>
      Arr.makeBy(4, (index) => ({
        id: `blk-${index}`,
        isA: index % 2 === 0,
        x: -0.78 + index * 0.52,
      })),
    []
  );

  const links = useMemo(
    () =>
      Arr.makeBy(3, (index) => ({
        id: `lnk-${index}`,
        x: -0.52 + index * 0.52,
      })),
    []
  );

  useFrame((_, delta) => {
    if (!playing || waterRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.2;
    const t = phaseRef.current % 1;
    waterRef.current.position.set(0, 0.56 - t * 0.42, 0.22);
  });

  const linkColor = profile.isAmide
    ? ORGANIC_COLORS.amideBlue
    : ORGANIC_COLORS.esterRose;

  return (
    <group>
      <SimulationTicker running={playing} />
      <NylonCamera />
      {/* Alternating bifunctional monomer blocks */}
      {Arr.map(blocks, (blk) => (
        <mesh castShadow key={blk.id} position={[blk.x, 0.62, 0]}>
          <boxGeometry args={[0.34, 0.24, 0.22]} />
          <meshStandardMaterial
            color={blk.isA ? ORGANIC_COLORS.monomerA : ORGANIC_COLORS.monomerB}
            roughness={0.42}
          />
        </mesh>
      ))}
      {/* Amide or ester linkages joining blocks */}
      {Arr.map(links, (lnk) => (
        <mesh key={lnk.id} position={[lnk.x, 0.62, 0]}>
          <sphereGeometry args={[0.075, 14, 12]} />
          <meshStandardMaterial color={linkColor} />
        </mesh>
      ))}
      {/* Eliminated H2O condensation byproduct dropping out */}
      <group position={[0, 0.32, 0.22]} ref={waterRef}>
        <mesh>
          <sphereGeometry args={[0.064, 12, 10]} />
          <meshStandardMaterial color={ORGANIC_COLORS.waterBlue} />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.82, 0.94, 0]}
      >
        <span>{parts.monomerA}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.82, 0.94, 0]}
      >
        <span>{parts.monomerB}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.98, 0]}
      >
        <span>
          {parts.esterOrAmideLink} ({profile.linkLabel})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 0.34, 0]}
      >
        <span>{parts.polymerChain}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.56, 0.2, 0.28]}
      >
        <span>{parts.waterByproduct}</span>
      </ThreeLabel>
    </group>
  );
}
