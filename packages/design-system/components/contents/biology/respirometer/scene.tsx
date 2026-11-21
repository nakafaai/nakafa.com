import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useRunClock } from "@repo/design-system/components/contents/biology/clock";
import {
  BEAKER,
  Beaker,
} from "@repo/design-system/components/contents/biology/respirometer/beaker";
import {
  along,
  BOARD,
  boardFrame,
  FACE_GAP,
  ScaleBoard,
} from "@repo/design-system/components/contents/biology/respirometer/board";
import type { Tube } from "@repo/design-system/components/contents/biology/respirometer/gas";
import {
  DROP_LENGTH,
  dropTravel,
  fillDepth,
  scaleSpan,
} from "@repo/design-system/components/contents/biology/respirometer/gas";
import {
  BOILING_TUBE,
  CAPILLARY,
  TUBE_BORE,
} from "@repo/design-system/components/contents/biology/respirometer/glass";
import {
  ARM,
  BoardJaws,
  BossArm,
  RetortStand,
  STAND,
  TubeJaws,
  tubeStop,
} from "@repo/design-system/components/contents/biology/respirometer/stand";
import { BathThermometer } from "@repo/design-system/components/contents/biology/respirometer/thermometer";
import {
  Capillary,
  HOLES,
  Respirometer,
} from "@repo/design-system/components/contents/biology/respirometer/tube";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { RESPIROMETER_COLORS } from "@repo/design-system/lib/material/respirometer";
import { Array as Arr } from "effect";
import type { ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { Vector3 } from "three";

/** Both respirometers, each named by what stands in its foot. */
const TUBES = ["potash", "water"] as const satisfies readonly Tube[];

/** Where each tube stands across the bath, in metres: water on the left, potassium hydroxide on the right. */
const LANE = { potash: 0.023, water: -0.023 } as const;

/** Where the two boiling tubes stand in the bath, so its water parts round them. */
const WELLS = Arr.map(TUBES, (tube) => LANE[tube]);

/** How high each tube's foot stands, in metres: on the stand's base, 5 cm clear of the beaker's floor. */
const TUBE_FOOT = STAND.base.thickness + BEAKER.wall + 0.05;

/** How high each capillary's level run lies above the bench, in metres: the water one passes over the other tube. */
const RUN = { potash: 0.24, water: 0.272 } as const;

/**
 * How much solution stands in each tube's foot: 5 cm³ of potassium
 * hydroxide solution, or the same of water (Edexcel International A level
 * Biology Core Practical 16, rate of respiration and RQ).
 */
const SOLUTION = 5e-6;

/** Where the stand that holds the tubes has its rod: behind the bath, in metres. */
const ROD = { x: 0, z: -0.105 } as const;

/** How high each tube's clamp grips it, in metres, one above the other on the one rod. */
const GRIP = { potash: 0.158, water: 0.186 } as const;

/** Where the scale board's left edge stands, in metres: just clear of the bath. */
const BOARD_LEFT = BEAKER.radius + 0.012;

/** How many minutes pass in a second while the card plays. */
const MINUTES_PER_SECOND = 2;

/**
 * Two respirometers of germinating mung beans in one water bath, clamped to
 * a retort stand, their capillaries running level along a scale board held
 * by a second stand, and the coloured drops moving along them from the
 * run's clock every frame. Every part stands at its real size, and the drops
 * move at real size: a millimetre of travel is a millimetre on the scale.
 */
export function RespirometerScene({
  carbonDioxide,
  elapsed,
  minutes,
  onElapsed,
  oxygen,
}: {
  readonly carbonDioxide: number;
  readonly elapsed: number;
  readonly minutes: number;
  readonly onElapsed: (minutes: number) => void;
  readonly oxygen: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (playing) {
      invalidate();
    }
  }, [invalidate, playing]);
  const clock = useRunClock({
    elapsed,
    onElapsed,
    perSecond: MINUTES_PER_SECOND,
    steps: 40,
    total: minutes,
  });
  const narrow = useThree((state) => state.size.width < 600);
  const span = scaleSpan(oxygen, carbonDioxide);
  const zero = BOARD_LEFT + BOARD.margin - along(span.to);
  const end = zero + along(span.from) + BOARD.margin;
  const drops = { potash: useRef<Group>(null), water: useRef<Group>(null) };

  useFrame(() => {
    Arr.forEach(TUBES, (tube) => {
      const travel = dropTravel(
        tube,
        oxygen,
        carbonDioxide,
        clock.current,
        minutes
      );
      drops[tube].current?.position.setX(
        zero + along(travel) + DROP_LENGTH / 2000
      );
    });
  });

  return (
    <group>
      <RespirometerCamera />
      <group position={[-0.62, 0, 0.1]}>
        <LabBench />
      </group>
      <group position={[ROD.x, 0, ROD.z]}>
        <RetortStand />
        {Arr.map(TUBES, (tube) => (
          <BossArm
            height={GRIP[tube]}
            key={tube}
            stop={tubeStop(BOILING_TUBE.radius)}
            target={[LANE[tube] - ROD.x, -ROD.z]}
          >
            <TubeJaws grip={BOILING_TUBE.radius} />
          </BossArm>
        ))}
      </group>
      <group position={[0, STAND.base.thickness, 0]}>
        <Beaker wells={WELLS} />
        <BathThermometer />
      </group>
      {Arr.map(TUBES, (tube) => (
        <TubeSet drop={drops[tube]} end={end} key={tube} tube={tube} />
      ))}
      <group position={[zero, 0, -FACE_GAP]}>
        <ScaleBoard
          back={span.back}
          from={span.from}
          lanes={[
            [RUN.potash, -1],
            [RUN.water, 1],
          ]}
          step={narrow ? 20 : 10}
          to={span.to}
        />
      </group>
      <BoardStand from={span.from} to={span.to} zero={zero} />
      <TubeLabels />
    </group>
  );
}

/**
 * One respirometer at its lane in the bath, its capillary running level at
 * its height to `end`, and its coloured drop, which the scene moves along
 * the capillary through `drop`.
 */
function TubeSet({
  drop,
  end,
  tube,
}: {
  readonly drop: RefObject<Group | null>;
  readonly end: number;
  readonly tube: Tube;
}) {
  const bend = LANE[tube] + HOLES.capillary + CAPILLARY.bend;
  return (
    <group>
      <group position={[LANE[tube], TUBE_FOOT, 0]}>
        <Respirometer
          depth={fillDepth(SOLUTION, TUBE_BORE)}
          salt={tube === "potash" ? 3 : 7}
        >
          <Capillary reach={end - bend} rise={RUN[tube] - TUBE_FOOT} />
        </Respirometer>
      </group>
      <group position={[0, RUN[tube], 0]} ref={drop}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry
            args={[CAPILLARY.bore, CAPILLARY.bore, DROP_LENGTH / 1000, 12]}
          />
          <meshPhysicalMaterial
            clearcoat={1}
            clearcoatRoughness={0.1}
            color={RESPIROMETER_COLORS.dye}
            roughness={0.25}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The second retort stand, behind the scale board's right end, its clamp
 * holding the board by its top edge so its face stands just behind both
 * capillaries.
 */
function BoardStand({
  from,
  to,
  zero,
}: {
  readonly from: number;
  readonly to: number;
  readonly zero: number;
}) {
  const frame = boardFrame(from, to, [RUN.potash, RUN.water]);
  const grip = zero + frame.right - 0.012;
  const rod = { x: grip + ARM.offset, z: -FACE_GAP - BOARD.thickness - 0.075 };
  return (
    <group position={[rod.x, 0, rod.z]}>
      <RetortStand />
      <BossArm
        height={frame.top}
        stop={0.0032}
        target={[grip - rod.x, -FACE_GAP - BOARD.thickness - rod.z]}
      >
        <BoardJaws drop={0.014} thickness={BOARD.thickness} />
      </BossArm>
    </group>
  );
}

/** How far outside the bath's wall a solution's name stands, in metres, clear of the glass. */
const LABEL_GAP = 0.016;

/**
 * The names of the two solutions beside the bath, at the height of the
 * solution in each tube's foot.
 */
function TubeLabels() {
  const height =
    TUBE_FOOT + BOILING_TUBE.wall + fillDepth(SOLUTION, TUBE_BORE) / 2;
  return (
    <group>
      <TubeLabel height={height} lane={LANE.water}>
        <InlineMath math="\mathrm{H_2O}" />
      </TubeLabel>
      <TubeLabel height={height} lane={LANE.potash}>
        <InlineMath math="\mathrm{KOH}" />
      </TubeLabel>
    </group>
  );
}

/**
 * The name of one tube's solution, kept beside the bath on the side of the
 * screen its tube stands on however the reader turns the rig, so it never
 * lies over the glass or meets the other name: every frame it stands just
 * outside the bath's wall along the camera's right, and its anchor flips
 * only when the tube crosses to the other side of the screen.
 */
function TubeLabel({
  children,
  height,
  lane,
}: {
  readonly children: ReactNode;
  readonly height: number;
  readonly lane: number;
}) {
  const ink = useLabelInk();
  const holder = useRef<Group>(null);
  const right = useMemo(() => new Vector3(), []);
  const [side, setSide] = useState<1 | -1>(lane > 0 ? 1 : -1);
  const reach = BEAKER.radius + LABEL_GAP;

  useFrame(({ camera }) => {
    const group = holder.current;
    if (group === null) {
      return;
    }
    right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    const facing = lane * right.x >= 0 ? 1 : -1;
    group.position.set(
      right.x * facing * reach,
      height,
      right.z * facing * reach
    );
    if (facing !== side) {
      setSide(facing);
    }
  });

  return (
    <group ref={holder}>
      <ThreeLabel
        anchorX={side === 1 ? "left" : "right"}
        color={ink}
        fontSize={0.012}
        maximumFontSize={20}
        minimumFontSize={14}
        position={[0, 0, 0]}
      >
        {children}
      </ThreeLabel>
    </group>
  );
}

/** The camera's aim, in metres: the middle of the rig, from the bath to the board. */
const TARGET = [0.08, 0.16, 0] as const;

/** Looks at the rig from the front, a little from the right and above, farther back on a narrow card. */
function RespirometerCamera() {
  const narrow = useThree(
    (state) => state.size.width < state.size.height * 1.2
  );
  const distance = narrow ? 0.57 : 0.48;
  const azimuth = 0.32;
  const elevation = 0.2;
  return (
    <CameraControls
      cameraPosition={[
        TARGET[0] + distance * Math.sin(azimuth) * Math.cos(elevation),
        TARGET[1] + distance * Math.sin(elevation),
        TARGET[2] + distance * Math.cos(azimuth) * Math.cos(elevation),
      ]}
      cameraTarget={TARGET}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={0.12}
    />
  );
}
