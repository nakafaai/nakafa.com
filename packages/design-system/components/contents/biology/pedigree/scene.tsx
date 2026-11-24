import { useThree } from "@react-three/fiber";
import type { HumanPattern } from "@repo/design-system/components/contents/biology/pedigree/model";
import { evaluatePedigreeTree } from "@repo/design-system/components/contents/biology/pedigree/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr, Match } from "effect";

function PedigreeCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.45, 3.35] : [0, 1.2, 2.75]}
      cameraTarget={[0, 0.72, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

function nodeColor(status: "affected" | "carrier" | "normal"): string {
  return Match.value(status).pipe(
    Match.when("normal", () => GENETICS_COLORS.normalGray),
    Match.when("carrier", () => GENETICS_COLORS.carrierAmber),
    Match.when("affected", () => GENETICS_COLORS.affectedRed),
    Match.exhaustive
  );
}

export function PedigreeSexLinkedScene({
  parts,
  pattern,
}: {
  readonly parts: Readonly<
    Record<
      | "affected"
      | "carrier"
      | "female"
      | "male"
      | "xChromosome"
      | "yChromosome",
      string
    >
  >;
  readonly pattern: HumanPattern;
}) {
  const nodes = evaluatePedigreeTree(pattern);

  return (
    <group>
      <PedigreeCamera />
      {/* Parental mating bar and descent stem */}
      <mesh position={[0, 1.04, -0.04]}>
        <boxGeometry args={[0.84, 0.03, 0.03]} />
        <meshStandardMaterial color={GENETICS_COLORS.boardSlate} />
      </mesh>
      <mesh position={[0, 0.88, -0.04]}>
        <boxGeometry args={[0.03, 0.3, 0.03]} />
        <meshStandardMaterial color={GENETICS_COLORS.boardSlate} />
      </mesh>
      <mesh position={[0, 0.73, -0.04]}>
        <boxGeometry args={[1.34, 0.03, 0.03]} />
        <meshStandardMaterial color={GENETICS_COLORS.boardSlate} />
      </mesh>

      {/* Pedigree nodes: cubes for males, spheres for females */}
      {Arr.map(nodes, (node) => (
        <group key={node.id} position={[node.x, node.y, 0]}>
          {node.sex === "male" ? (
            <mesh castShadow>
              <boxGeometry args={[0.2, 0.2, 0.14]} />
              <meshStandardMaterial
                color={nodeColor(node.status)}
                roughness={0.42}
              />
            </mesh>
          ) : (
            <mesh castShadow>
              <sphereGeometry args={[0.115, 16, 14]} />
              <meshStandardMaterial
                color={nodeColor(node.status)}
                roughness={0.42}
              />
            </mesh>
          )}
          <ThreeLabel
            color={GENETICS_COLORS.labelInk}
            fontSize="compact"
            position={[0, -0.2, 0]}
          >
            <span>{node.label}</span>
          </ThreeLabel>
        </group>
      ))}

      {/* Reference X and Y chromosomes at base */}
      <mesh position={[-0.24, 0.18, 0]} rotation={[0, 0, 0.25]}>
        <capsuleGeometry args={[0.03, 0.18, 6, 10]} />
        <meshStandardMaterial color={GENETICS_COLORS.xChromosome} />
      </mesh>
      <mesh position={[-0.24, 0.18, 0]} rotation={[0, 0, -0.25]}>
        <capsuleGeometry args={[0.03, 0.18, 6, 10]} />
        <meshStandardMaterial color={GENETICS_COLORS.xChromosome} />
      </mesh>
      <mesh position={[0.24, 0.16, 0]}>
        <capsuleGeometry args={[0.026, 0.1, 6, 10]} />
        <meshStandardMaterial color={GENETICS_COLORS.yChromosome} />
      </mesh>

      {/* Legend labels */}
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.95, 1.06, 0]}
      >
        <span>{parts.male}</span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0.95, 1.06, 0]}
      >
        <span>
          {parts.female} / {parts.carrier}
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[1.0, 0.56, 0]}
      >
        <span>{parts.affected}</span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.64, 0.16, 0]}
      >
        <span>{parts.xChromosome}</span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0.64, 0.16, 0]}
      >
        <span>{parts.yChromosome}</span>
      </ThreeLabel>
    </group>
  );
}
