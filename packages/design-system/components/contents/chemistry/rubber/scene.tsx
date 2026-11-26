import { useThree } from "@react-three/fiber";
import type { RubberState } from "@repo/design-system/components/contents/chemistry/rubber/model";
import { evaluateRubberStretch } from "@repo/design-system/components/contents/chemistry/rubber/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr } from "effect";
import { useMemo } from "react";

function RubberCamera() {
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

export function RubberVulcanizationScene({
  parts,
  state,
  stretchPercent,
}: {
  readonly parts: Readonly<
    Record<
      "doubleBond" | "isopreneChain" | "sulfurCrosslink" | "tensionArrow",
      string
    >
  >;
  readonly state: RubberState;
  readonly stretchPercent: number;
}) {
  const mech = evaluateRubberStretch(state, stretchPercent);
  const scaleX = 1 + (stretchPercent / 100) * 0.28;

  const bridges = useMemo(
    () =>
      Arr.makeBy(3, (index) => ({
        id: `s-${index}`,
        x: -0.52 + index * 0.52,
      })),
    []
  );

  return (
    <group>
      <RubberCamera />
      {/* Upper polyisoprene chain (slips right in natural latex) */}
      <mesh
        castShadow
        position={[mech.chainSlip, 0.78, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[1, scaleX, 1]}
      >
        <cylinderGeometry args={[0.06, 0.06, 1.5, 16]} />
        <meshStandardMaterial color={ORGANIC_COLORS.isopreneEmerald} />
      </mesh>
      {/* Lower polyisoprene chain */}
      <mesh
        castShadow
        position={[-mech.chainSlip * 0.5, 0.36, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[1, scaleX, 1]}
      >
        <cylinderGeometry args={[0.06, 0.06, 1.5, 16]} />
        <meshStandardMaterial color={ORGANIC_COLORS.isopreneEmerald} />
      </mesh>
      {/* C=C reactive double bond sites (unlinked in natural latex) or -S-S- crosslinks */}
      {Arr.map(bridges, (bridge) =>
        mech.crosslinked ? (
          <mesh castShadow key={bridge.id} position={[bridge.x, 0.57, 0]}>
            <cylinderGeometry args={[0.036, 0.036, 0.42, 12]} />
            <meshStandardMaterial color={ORGANIC_COLORS.sulfurBridge} />
          </mesh>
        ) : (
          <mesh
            key={bridge.id}
            position={[bridge.x + mech.chainSlip, 0.78, 0.08]}
          >
            <sphereGeometry args={[0.056, 12, 10]} />
            <meshStandardMaterial color={ORGANIC_COLORS.doubleBondGold} />
          </mesh>
        )
      )}
      {/* Tension arrow pulling right */}
      <mesh
        castShadow
        position={[1.08, 0.78, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <coneGeometry args={[0.075, 0.24, 12]} />
        <meshStandardMaterial color={ORGANIC_COLORS.furnaceRed} />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 1.04, 0]}
      >
        <span>{parts.isopreneChain}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[1.06, 1.04, 0]}
      >
        <span>{parts.tensionArrow}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.14, 0.22]}
      >
        <span>
          {mech.crosslinked ? parts.sulfurCrosslink : parts.doubleBond}
        </span>
      </ThreeLabel>
    </group>
  );
}
