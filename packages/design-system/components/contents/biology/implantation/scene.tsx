import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  blastomeres,
  embryoAt,
  MAX_DAY,
} from "@repo/design-system/components/contents/biology/implantation/cleavage";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.86, 2.25];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.52, 0];

export type ImplantationPart =
  | "ovary"
  | "ampulla"
  | "tube"
  | "uterus"
  | "endometrium"
  | "sperm"
  | "zona"
  | "innerCellMass"
  | "trophoblast"
  | "cavity"
  | "hcg";

/**
 * 3D journey of the early embryo from fertilisation in the ampulla along the
 * Fallopian tube through cleavage (constant total volume inside the zona
 * pellucida) to blastocyst implantation and HCG release into the endometrium.
 */
export function ImplantationScene({
  day,
  onDay,
  parts,
}: {
  readonly day: number;
  readonly onDay: (next: number) => void;
  readonly parts: Readonly<Record<ImplantationPart, string>>;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const timer = useRef(0);

  if (!playing) {
    timer.current = 0;
  }

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    timer.current += simulationStep(delta);
    if (timer.current >= 1.2) {
      timer.current = 0;
      onDay(day >= MAX_DAY ? 0 : day + 1);
    }
  });

  const embryo = embryoAt(day);
  const cells = useMemo(() => blastomeres(embryo.stage), [embryo.stage]);

  return (
    <group>
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.04, 1.0]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.worktop}
          roughness={0.65}
        />
      </mesh>

      {/* Ovary on far left */}
      <mesh castShadow position={[-0.96, 0.56, -0.05]}>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.ovary} />
      </mesh>
      <ThreeLabel
        anchorY="top"
        color={ink}
        gap={0.04}
        position={[-0.96, 0.36, 0]}
      >
        {parts.ovary}
      </ThreeLabel>

      {/* Fallopian tube (ampulla + straight passage) */}
      <mesh position={[-0.3, 0.7, -0.08]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.14, 0.17, 1.15, 22]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.petal}
          opacity={0.35}
          transparent
        />
      </mesh>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        gap={0.04}
        position={[-0.72, 0.9, 0]}
      >
        {parts.ampulla}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        gap={0.04}
        position={[-0.14, 0.88, 0]}
      >
        {parts.tube}
      </ThreeLabel>

      {/* Uterine cavity and thick spongy endometrium wall on the right */}
      <mesh position={[0.64, 0.44, -0.1]}>
        <boxGeometry args={[0.64, 0.68, 0.24]} />
        <meshStandardMaterial
          color={CELL_COLORS.reticulum}
          opacity={0.45}
          transparent
        />
      </mesh>
      <mesh castShadow position={[0.68, 0.16, 0]}>
        <boxGeometry args={[0.62, 0.26, 0.36]} />
        <meshStandardMaterial color={CELL_COLORS.lysosome} roughness={0.6} />
      </mesh>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        gap={0.04}
        position={[0.64, 0.82, 0]}
      >
        {parts.uterus}
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        gap={0.04}
        position={[1.02, 0.16, 0]}
      >
        {parts.endometrium}
      </ThreeLabel>

      {/* Moving embryo with constant-radius zona pellucida (shed on implantation) */}
      <group position={embryo.position}>
        {embryo.stage !== "implanting" && (
          <mesh>
            <sphereGeometry args={[0.155, 22, 22]} />
            <meshPhysicalMaterial
              color={LABORATORY_COLORS.polystyrene}
              opacity={0.35}
              roughness={0.15}
              transparent
            />
          </mesh>
        )}

        {Arr.map(cells, (cell) => (
          <mesh castShadow key={cell.id} position={cell.offset}>
            <sphereGeometry args={[cell.radius, 16, 16]} />
            <meshStandardMaterial
              color={cell.inner ? PLOT_COLORS.teal : PLOT_COLORS.amber}
              roughness={0.45}
            />
          </mesh>
        ))}

        {/* HCG hormone particles released into endometrium on implantation */}
        {embryo.hcg &&
          Arr.map([-0.14, 0, 0.14] as const, (dx) => (
            <mesh key={dx} position={[dx, -0.18, 0.08]}>
              <sphereGeometry args={[0.026, 12, 12]} />
              <meshStandardMaterial
                color={PLOT_COLORS.orange}
                emissive={PLOT_COLORS.orange}
                emissiveIntensity={0.45}
              />
            </mesh>
          ))}

        {embryo.stage === "blastocyst" && (
          <ThreeLabel
            anchorY="top"
            color={ink}
            gap={0.04}
            position={[0, -0.2, 0]}
          >
            {parts.trophoblast}
          </ThreeLabel>
        )}
        {embryo.hcg && (
          <ThreeLabel
            anchorY="top"
            color={ink}
            gap={0.04}
            position={[0, -0.26, 0.1]}
          >
            {parts.hcg}
          </ThreeLabel>
        )}
      </group>
    </group>
  );
}
