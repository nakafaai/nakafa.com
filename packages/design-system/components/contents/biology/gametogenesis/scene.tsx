import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  CellKey,
  Level,
  Sex,
} from "@repo/design-system/components/contents/biology/gametogenesis/division";
import {
  antrumForms,
  coronaCells,
  coronaForms,
  eggForms,
  germForms,
  nucleusForms,
  ovumForms,
  polarForms,
  spermForms,
  zonaForms,
} from "@repo/design-system/components/contents/biology/gametogenesis/gamete";
import type { AnatomyPart } from "@repo/design-system/components/contents/biology/gametogenesis/organs";
import {
  GonadView,
  SystemView,
} from "@repo/design-system/components/contents/biology/gametogenesis/organs";
import { SlideStage } from "@repo/design-system/components/contents/biology/workbench";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Body, Tuft } from "@repo/design-system/components/three/organism/body";
import type { Stroke } from "@repo/design-system/components/three/organism/life";
import { Skin } from "@repo/design-system/components/three/organism/skin";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr, Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];
const STEP_SECONDS = 2.2;

/** The camera stands further back on a narrow screen, so every label stays inside the frame. */
function GameteCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.97, 3.75] : [0, 0.88, 2.34]}
      cameraTarget={CAMERA_TARGET}
      fov={38}
    />
  );
}

/** A sperm cell's tail beats in a wave that grows from the middle piece to its tip. */
const SPERM_STROKE: Stroke = {
  axis: 1,
  from: -0.07,
  reach: 0.045,
  to: 0.84,
  turns: 1.3,
};

const CORONA = coronaCells(300);

/** The surface of one living cell: a moist, faintly grained membrane. */
function CellSkin({ clear }: { readonly clear: number }) {
  return (
    <Skin
      bump={0.3}
      clear={clear}
      flesh={BIOLOGY_COLORS.tissuePink}
      glow={0.3}
      repeat={[5, 5]}
      roughness={0.4}
      surface="cytoplasm"
      wet={0.8}
    />
  );
}

/** A human sperm cell: acrosome, head, the spiral-wound middle piece and a tail that beats while the card plays. */
function SpermatozoonSpecimen({
  ink,
  parts,
}: {
  readonly ink: string;
  readonly parts: Readonly<Record<AnatomyPart, string>>;
}) {
  return (
    <group position={[0, 0.58, 0]}>
      <Body pace={7} shape={spermForms} stroke={SPERM_STROKE}>
        <Skin
          bump={0.3}
          repeat={[6, 3]}
          roughness={0.38}
          surface="cytoplasm"
          wet={0.85}
        />
      </Body>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[-0.63, 0.02, 0]}
      >
        {parts.acrosome}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[-0.45, 0.1, 0]}
      >
        {parts.head}
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[-0.2, -0.06, 0]}
      >
        {parts.middle}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.42, 0.08, 0]}
      >
        {parts.tail}
      </ThreeLabel>
    </group>
  );
}

/** A ripe egg cell in its clear zona pellucida, crowned with follicular cells beside a pocket of follicular fluid. */
function OocyteSpecimen({
  ink,
  parts,
}: {
  readonly ink: string;
  readonly parts: Readonly<Record<AnatomyPart, string>>;
}) {
  return (
    <group position={[0, 0.58, 0]}>
      <Body shape={ovumForms}>
        <CellSkin clear={0} />
      </Body>
      <Tuft placements={CORONA} shape={coronaForms}>
        <CellSkin clear={0} />
      </Tuft>
      <Body cast={false} shape={antrumForms}>
        <CellSkin clear={0.4} />
      </Body>
      <Body cast={false} shape={zonaForms}>
        <CellSkin clear={0.62} />
      </Body>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0, 0.42, 0]}
      >
        {parts.follicular}
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.3, -0.24, 0.2]}
      >
        {parts.antrum}
      </ThreeLabel>
    </group>
  );
}

/** How large a dividing cell is drawn: a polar body is small, and an egg cell keeps nearly everything. */
function cellRadius(sex: Sex, step: number, polar: boolean) {
  if (polar) {
    return 0.072;
  }
  if (step === 1) {
    return 0.22;
  }
  return sex === "female" ? 0.19 : 0.15;
}

/** One cell of a division: its clear body and the stained nucleus inside it. */
function DividingCell({
  polar,
  radius,
  sex,
}: {
  readonly polar: boolean;
  readonly radius: number;
  readonly sex: Sex;
}) {
  const body = sex === "male" ? germForms : eggForms;
  return (
    <group scale={radius}>
      <Body shape={nucleusForms}>
        <CellSkin clear={0} />
      </Body>
      <Body shape={polar ? polarForms : body}>
        <CellSkin clear={0.45} />
      </Body>
    </group>
  );
}

/**
 * 3D gametogenesis scene covering four zoom levels: reproductive tract
 * (`system`), gonad cross-section (`gonad`), meiotic cell division (`meiosis`),
 * and mature gamete ultrastructure (`gamete`) for male and female sexes.
 */
export function GametogenesisScene({
  cells,
  level,
  onStep,
  parts,
  sex,
  step,
}: {
  readonly cells: Readonly<Record<CellKey, string>>;
  readonly level: Level;
  readonly onStep: (next: number) => void;
  readonly parts: Readonly<Record<AnatomyPart, string>>;
  readonly sex: Sex;
  readonly step: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const rootRef = useRef<Group>(null);
  const timer = useRef(0);
  const phase = useRef(0);

  const rewind = () => {
    timer.current = 0;
    phase.current = 0;
    if (rootRef.current !== null) {
      rootRef.current.rotation.set(0, 0, 0);
    }
    invalidate();
  };

  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing) {
      timer.current = 0;
      return;
    }
    const dt = simulationStep(delta);
    phase.current += dt;
    if (level === "meiosis") {
      timer.current += dt;
      if (timer.current >= STEP_SECONDS) {
        timer.current = 0;
        onStep((step + 1) % 4);
      }
    } else if (rootRef.current !== null) {
      rootRef.current.rotation.y = Math.sin(phase.current * 0.65) * 0.28;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <GameteCamera />

      <SlideStage position={[0, 0, 0]} radius={0.98} />

      <group ref={rootRef}>
        {Match.value(level).pipe(
          Match.when("system", () => <SystemView parts={parts} sex={sex} />),
          Match.when("gonad", () => <GonadView parts={parts} sex={sex} />),
          Match.when("meiosis", () => {
            let xs: readonly number[] = [-0.54, -0.18, 0.18, 0.54];
            if (step <= 1) {
              xs = [0];
            } else if (step === 2) {
              xs = [-0.32, 0.32];
            }
            const count = xs.length;
            return (
              <group>
                {Arr.map(xs, (x, idx) => {
                  const isPolar = sex === "female" && count > 1 && idx > 0;
                  return (
                    <group key={x} position={[x, 0.58, 0]}>
                      <DividingCell
                        polar={isPolar}
                        radius={cellRadius(sex, step, isPolar)}
                        sex={sex}
                      />
                      {isPolar && idx === 1 ? (
                        <ThreeLabel
                          anchorY="top"
                          color={ink}
                          fontSize="compact"
                          gap={0.05}
                          position={[0, -0.14, 0]}
                        >
                          {cells.polarBody}
                        </ThreeLabel>
                      ) : null}
                    </group>
                  );
                })}
              </group>
            );
          }),
          Match.when("gamete", () =>
            sex === "male" ? (
              <SpermatozoonSpecimen ink={ink} parts={parts} />
            ) : (
              <OocyteSpecimen ink={ink} parts={parts} />
            )
          ),
          Match.exhaustive
        )}
      </group>
    </group>
  );
}
