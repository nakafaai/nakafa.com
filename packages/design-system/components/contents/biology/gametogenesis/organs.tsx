import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { Sex } from "@repo/design-system/components/contents/biology/gametogenesis/division";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";

export type AnatomyPart =
  | "testis"
  | "scrotum"
  | "epididymis"
  | "spermDuct"
  | "seminalVesicle"
  | "prostate"
  | "cowper"
  | "urethra"
  | "penis"
  | "ovary"
  | "oviduct"
  | "uterus"
  | "cervix"
  | "vagina"
  | "tubule"
  | "interstitial"
  | "follicle"
  | "corpusLuteum"
  | "head"
  | "acrosome"
  | "middle"
  | "tail"
  | "follicular"
  | "antrum";

/** 3D male and female reproductive tract anatomy at the organ-system scale. */
export function SystemView({
  parts,
  sex,
}: {
  readonly parts: Readonly<Record<AnatomyPart, string>>;
  readonly sex: Sex;
}) {
  const ink = useLabelInk();

  if (sex === "male") {
    return (
      <group>
        <mesh castShadow position={[-0.35, 0.28, 0]}>
          <sphereGeometry args={[0.13, 20, 20]} />
          <meshStandardMaterial color={BIOLOGY_COLORS.tubule} />
        </mesh>
        <mesh position={[-0.25, 0.34, 0]}>
          <capsuleGeometry args={[0.045, 0.14, 10, 14]} />
          <meshStandardMaterial color={PLOT_COLORS.amber} />
        </mesh>
        <mesh position={[-0.1, 0.62, 0]} rotation={[0, 0, -0.45]}>
          <cylinderGeometry args={[0.025, 0.025, 0.52, 12]} />
          <meshStandardMaterial color={PLOT_COLORS.teal} />
        </mesh>
        <mesh castShadow position={[0.14, 0.72, 0]}>
          <sphereGeometry args={[0.11, 18, 18]} />
          <meshStandardMaterial color={CELL_COLORS.reticulum} />
        </mesh>
        <mesh castShadow position={[0.28, 0.82, -0.06]}>
          <capsuleGeometry args={[0.055, 0.12, 8, 14]} />
          <meshStandardMaterial color={PLOT_COLORS.violet} />
        </mesh>
        <mesh castShadow position={[0.38, 0.42, 0]} rotation={[0, 0, 0.55]}>
          <capsuleGeometry args={[0.068, 0.36, 10, 16]} />
          <meshStandardMaterial color={BIOLOGY_COLORS.tubule} />
        </mesh>
        <ThreeLabel
          anchorX="right"
          color={ink}
          gap={0.04}
          position={[-0.48, 0.28, 0]}
        >
          {parts.testis}
        </ThreeLabel>
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          gap={0.04}
          position={[-0.14, 0.86, 0]}
        >
          {parts.spermDuct}
        </ThreeLabel>
        <ThreeLabel
          anchorX="left"
          color={ink}
          gap={0.04}
          position={[0.3, 0.72, 0]}
        >
          {parts.prostate}
        </ThreeLabel>
        <ThreeLabel
          anchorX="left"
          color={ink}
          gap={0.04}
          position={[0.52, 0.42, 0]}
        >
          {parts.urethra}
        </ThreeLabel>
      </group>
    );
  }

  return (
    <group>
      <mesh castShadow position={[0, 0.64, 0]}>
        <capsuleGeometry args={[0.19, 0.2, 12, 22]} />
        <meshStandardMaterial color={CELL_COLORS.reticulum} />
      </mesh>
      <mesh castShadow position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.075, 0.095, 0.16, 18]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.petal} />
      </mesh>
      <mesh castShadow position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.085, 0.085, 0.24, 18]} />
        <meshStandardMaterial color={CELL_COLORS.lysosome} />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <group key={side}>
          <mesh
            position={[side * 0.36, 0.78, 0]}
            rotation={[0, 0, side * 1.15]}
          >
            <cylinderGeometry args={[0.035, 0.045, 0.42, 14]} />
            <meshStandardMaterial color={BIOLOGY_COLORS.petal} />
          </mesh>
          <mesh castShadow position={[side * 0.56, 0.68, 0]}>
            <sphereGeometry args={[0.1, 18, 18]} />
            <meshStandardMaterial color={BIOLOGY_COLORS.ovary} />
          </mesh>
        </group>
      ))}
      <ThreeLabel
        anchorX="left"
        color={ink}
        gap={0.04}
        position={[0.68, 0.68, 0]}
      >
        {parts.ovary}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        gap={0.04}
        position={[0.36, 0.9, 0]}
      >
        {parts.oviduct}
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        gap={0.04}
        position={[-0.22, 0.62, 0]}
      >
        {parts.uterus}
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        gap={0.04}
        position={[0.14, 0.36, 0]}
      >
        {parts.cervix}
      </ThreeLabel>
    </group>
  );
}

/** 3D testis seminiferous tubule or ovarian follicle/corpus luteum cutaway. */
export function GonadView({
  parts,
  sex,
}: {
  readonly parts: Readonly<Record<AnatomyPart, string>>;
  readonly sex: Sex;
}) {
  const ink = useLabelInk();

  if (sex === "male") {
    return (
      <group>
        {Arr.map([-0.36, 0, 0.36] as const, (x) => (
          <mesh
            castShadow
            key={x}
            position={[x, 0.56, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.15, 0.045, 14, 28]} />
            <meshStandardMaterial color={BIOLOGY_COLORS.tubule} />
          </mesh>
        ))}
        {Arr.map([-0.18, 0.18] as const, (x) => (
          <mesh key={x} position={[x, 0.56, 0.06]}>
            <sphereGeometry args={[0.055, 14, 14]} />
            <meshStandardMaterial color={PLOT_COLORS.amber} />
          </mesh>
        ))}
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          gap={0.04}
          position={[-0.36, 0.78, 0]}
        >
          {parts.tubule}
        </ThreeLabel>
        <ThreeLabel
          anchorY="top"
          color={ink}
          gap={0.04}
          position={[0.18, 0.42, 0]}
        >
          {parts.interstitial}
        </ThreeLabel>
      </group>
    );
  }

  return (
    <group>
      <mesh castShadow position={[0, 0.56, 0]} scale={[1.35, 0.95, 0.6]}>
        <sphereGeometry args={[0.42, 26, 26]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.ovary}
          opacity={0.45}
          transparent
        />
      </mesh>
      <mesh castShadow position={[-0.22, 0.58, 0.12]}>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshStandardMaterial color={PLOT_COLORS.teal} />
      </mesh>
      <mesh castShadow position={[0.22, 0.56, 0.12]}>
        <sphereGeometry args={[0.15, 20, 20]} />
        <meshStandardMaterial color={PLOT_COLORS.amber} />
      </mesh>
      <ThreeLabel
        anchorX="right"
        color={ink}
        gap={0.04}
        position={[-0.38, 0.64, 0]}
      >
        {parts.follicle}
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        gap={0.04}
        position={[0.38, 0.62, 0]}
      >
        {parts.corpusLuteum}
      </ThreeLabel>
    </group>
  );
}
