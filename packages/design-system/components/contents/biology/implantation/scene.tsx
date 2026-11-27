import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  blastomereForms,
  cellPlacements,
  passageForms,
  trophoblastForms,
  zonaForms,
} from "@repo/design-system/components/contents/biology/implantation/anatomy";
import {
  blastomeres,
  embryoAt,
  MAX_DAY,
} from "@repo/design-system/components/contents/biology/implantation/cleavage";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Body, Tuft } from "@repo/design-system/components/three/organism/body";
import { Skin } from "@repo/design-system/components/three/organism/skin";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";

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

/** The camera stands further back on a narrow screen, so the whole passage and its labels fit. */
function PassageCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.95, 4.3] : [0, 0.86, 2.25]}
      cameraTarget={CAMERA_TARGET}
      fov={38}
    />
  );
}

/** The surface of one cell of the embryo, or of the clear coat round it. */
function EmbryoSkin({ clear }: { readonly clear: number }) {
  return (
    <Skin
      bump={0.3}
      clear={clear}
      flesh={BIOLOGY_COLORS.tissuePink}
      glow={0.3}
      repeat={[4, 4]}
      roughness={0.4}
      surface="cytoplasm"
      wet={0.8}
    />
  );
}

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
  const { inner, outer } = useMemo(() => {
    const cells = blastomeres(embryo.stage);
    return {
      inner: cellPlacements(Arr.filter(cells, (cell) => cell.inner)),
      outer: cellPlacements(Arr.filter(cells, (cell) => !cell.inner)),
    };
  }, [embryo.stage]);

  return (
    <group>
      <PassageCamera />

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.04, 1.0]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.worktop}
          roughness={0.65}
        />
      </mesh>

      <Body shape={passageForms}>
        <Skin
          bump={0.45}
          flesh={BIOLOGY_COLORS.tissueDeep}
          glow={0.3}
          repeat={[5, 4]}
          roughness={0.55}
          surface="mucosa"
          wet={0.6}
        />
      </Body>
      <ThreeLabel
        anchorY="top"
        color={ink}
        gap={0.04}
        position={[-0.96, 0.36, 0]}
      >
        {parts.ovary}
      </ThreeLabel>

      <ThreeLabel
        anchorY="bottom"
        color={ink}
        gap={0.04}
        position={[-0.72, 0.94, 0]}
      >
        {parts.ampulla}
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        gap={0.04}
        position={[-0.1, 0.4, 0]}
      >
        {parts.tube}
      </ThreeLabel>

      <ThreeLabel
        anchorY="bottom"
        color={ink}
        gap={0.04}
        position={[0.92, 0.9, 0]}
      >
        {parts.uterus}
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        gap={0.04}
        position={[0.74, -0.05, 0.1]}
      >
        {parts.endometrium}
      </ThreeLabel>

      {/* Moving embryo with constant-radius zona pellucida (shed on implantation) */}
      <group position={embryo.position}>
        <Tuft placements={inner} shape={blastomereForms}>
          <EmbryoSkin clear={0} />
        </Tuft>
        <Tuft placements={outer} shape={trophoblastForms}>
          <EmbryoSkin clear={0} />
        </Tuft>
        {embryo.stage !== "implanting" && (
          <group scale={0.155}>
            <Body cast={false} shape={zonaForms}>
              <EmbryoSkin clear={0.66} />
            </Body>
          </group>
        )}

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
            anchorY="bottom"
            color={ink}
            gap={0.04}
            position={[0, 0.2, 0]}
          >
            {parts.trophoblast}
          </ThreeLabel>
        )}
        {embryo.hcg && (
          <ThreeLabel
            anchorX="right"
            color={ink}
            gap={0.04}
            position={[-0.2, -0.18, 0.1]}
          >
            {parts.hcg}
          </ThreeLabel>
        )}
      </group>
    </group>
  );
}
