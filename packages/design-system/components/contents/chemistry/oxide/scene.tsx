import { useThree } from "@react-three/fiber";
import type { PeriodOxide } from "@repo/design-system/components/contents/chemistry/oxide/model";
import { evaluatePeriodOxide } from "@repo/design-system/components/contents/chemistry/oxide/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Match } from "effect";
import { useMemo } from "react";

function OxideCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.45] : [0, 1.32, 2.8]}
      cameraTarget={[0, 0.58, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

function latticeColor(
  isOxide: boolean,
  structure: "giantCovalent" | "ionic" | "molecular"
): string {
  if (isOxide) {
    return PROCESS_COLORS.acidRed;
  }
  return structure === "giantCovalent"
    ? PROCESS_COLORS.silicaBlue
    : PROCESS_COLORS.anodeZinc;
}

export function PeriodThreeOxideScene({
  oxide,
  parts,
}: {
  readonly oxide: PeriodOxide;
  readonly parts: Readonly<
    Record<"latticeModel" | "oxideSample" | "phMeter" | "waterBeaker", string>
  >;
}) {
  const profile = evaluatePeriodOxide(oxide);
  const liquidColor = Match.value(profile.nature).pipe(
    Match.when("basic", () => PROCESS_COLORS.alkaliBlue),
    Match.when("amphoteric", () => PROCESS_COLORS.neutralGreen),
    Match.when("acidic", () => PROCESS_COLORS.acidRed),
    Match.exhaustive
  );

  const latticeNodes = useMemo(
    () =>
      Arr.makeBy(8, (index) => ({
        id: `n-${index}`,
        isOxide: index % 2 === 1,
        x: 0.42 + (index % 2) * 0.28,
        y: 0.32 + Math.floor(index / 4) * 0.28,
        z: Math.floor((index % 4) / 2) * 0.26 - 0.13,
      })),
    []
  );

  return (
    <group>
      <OxideCamera />
      {/* Left: Water beaker with pH probe */}
      <mesh position={[-0.56, 0.4, 0]}>
        <cylinderGeometry args={[0.36, 0.34, 0.72, 22, 1, true]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.glassClear}
          opacity={0.34}
          side={2}
          transparent
        />
      </mesh>
      <mesh position={[-0.56, 0.28, 0]}>
        <cylinderGeometry args={[0.32, 0.31, 0.46, 20]} />
        <meshStandardMaterial color={liquidColor} opacity={0.62} transparent />
      </mesh>
      {/* Oxide sample cube immersed */}
      <mesh castShadow position={[-0.64, 0.2, 0.06]}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshStandardMaterial color={PROCESS_COLORS.ceramicIvory} />
      </mesh>
      {/* Digital pH probe */}
      <mesh castShadow position={[-0.4, 0.72, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 0.78, 12]} />
        <meshStandardMaterial color={PROCESS_COLORS.ironDark} />
      </mesh>
      {/* Right: Bonding microstructure (ionic / giant covalent / discrete molecules) */}
      {profile.structure === "molecular" ? (
        <group position={[0.56, 0.56, 0]}>
          <mesh castShadow position={[-0.18, 0.12, 0]}>
            <sphereGeometry args={[0.1, 14, 12]} />
            <meshStandardMaterial color={PROCESS_COLORS.sulfurYellow} />
          </mesh>
          <mesh castShadow position={[0.16, -0.1, 0.06]}>
            <sphereGeometry args={[0.1, 14, 12]} />
            <meshStandardMaterial color={PROCESS_COLORS.acidRed} />
          </mesh>
        </group>
      ) : (
        <group>
          {Arr.map(latticeNodes, (node) => (
            <mesh castShadow key={node.id} position={[node.x, node.y, node.z]}>
              <sphereGeometry args={[node.isOxide ? 0.075 : 0.09, 12, 10]} />
              <meshStandardMaterial
                color={latticeColor(node.isOxide, profile.structure)}
              />
            </mesh>
          ))}
        </group>
      )}
      {/* Labels */}
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.4, 1.18, 0]}
      >
        <span>
          {parts.phMeter} (pH {profile.ph.toFixed(1)})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.95, 0.58, 0]}
      >
        <span>{parts.waterBeaker}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.86, 0.16, 0.3]}
      >
        <span>{parts.oxideSample}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.64, 0.96, 0]}
      >
        <span>{parts.latticeModel}</span>
      </ThreeLabel>
    </group>
  );
}
