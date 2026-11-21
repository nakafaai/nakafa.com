import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  Capillaries,
  Cells,
  Oxygen,
} from "@repo/design-system/components/contents/biology/muscle/blood";
import {
  CAPILLARIES,
  CENTRES,
  FRONT,
  MICRONS,
} from "@repo/design-system/components/contents/biology/muscle/bundle";
import { Fibres } from "@repo/design-system/components/contents/biology/muscle/fibre";
import { Lactate } from "@repo/design-system/components/contents/biology/muscle/lactate";
import { usePose } from "@repo/design-system/components/contents/biology/muscle/pose";
import { Sheath } from "@repo/design-system/components/contents/biology/muscle/sheath";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MUSCLE_COLORS } from "@repo/design-system/lib/material/muscle";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { MeshBasicMaterial } from "three";

/** The groove capillary over the top front of the fascicle, whose red cells a label points at and whose blood leaves by the arrow. */
const SHOWN = Arr.getUnsafe(CAPILLARIES, 1);

/** The groove capillary at the very front, which the capillary label points at. */
const FACING = Arr.getUnsafe(CAPILLARIES, 3);

/** The top fibre. */
const TOP = Arr.getUnsafe(CENTRES, 1);

/** Leaders draw after the tissue, over it. */
const LEADER = 10;

/** The scale bar's length, in micrometres. */
const BAR = 50;

/**
 * A small fascicle of a working skeletal muscle at tissue scale, one scene
 * unit to 10 µm: seven striated, multinucleate fibres in their perimysium,
 * cut across at the front, with capillaries between them carrying red blood
 * cells, oxygen leaving the cells for the fibres, and lactic acid building in
 * the fibres and leaving for the liver. Everything moves with the pose its
 * provider writes.
 */
export function MuscleScene({
  labels,
}: {
  readonly labels: {
    readonly capillary: string;
    readonly cell: string;
    readonly fibre: string;
    readonly liver?: string;
  };
}) {
  return (
    <group>
      <MuscleCamera />
      <Fibres />
      <Sheath />
      <Capillaries />
      <Cells />
      <Oxygen />
      <Lactate />
      <ScaleBar />
      <Callout
        anchor={["right", "bottom"]}
        at={[-8.5, TOP[0] + 6.8, TOP[1] - 6]}
        target={[-2, TOP[0] + 4, TOP[1] + 0.4]}
      >
        {labels.fibre}
      </Callout>
      <Callout
        anchor={["left", "bottom"]}
        at={[10, TOP[0] + 9, SHOWN[1] + 1]}
        target={[10, SHOWN[0] + 0.3, SHOWN[1] + 0.35]}
      >
        {labels.cell}
      </Callout>
      <Callout
        anchor={["center", "top"]}
        at={[1, -17, FACING[1] + 3]}
        target={[1, FACING[0] - 0.3, FACING[1] + 0.4]}
      >
        {labels.capillary}
      </Callout>
      <Outflow>
        {labels.liver === undefined ? null : (
          <Callout
            anchor={["center", "bottom"]}
            at={[-2, 2.7, 3.5]}
            target={[-2.2, 0.3, 0]}
          >
            {labels.liver}
          </Callout>
        )}
      </Outflow>
    </group>
  );
}

/**
 * A label set off the fascicle, joined by a thin leader to the point of the
 * part it names, so no word sits on the tissue. The leader is drawn over the
 * tissue, so it still reaches a part that lies in a groove between fibres.
 */
function Callout({
  anchor,
  at,
  children,
  target,
}: {
  readonly anchor: readonly ["center" | "left" | "right", "bottom" | "top"];
  readonly at: readonly [number, number, number];
  readonly children: string;
  readonly target: readonly [number, number, number];
}) {
  const ink = useLabelInk();
  // A material made in code, since JSX material props cannot turn off the depth test.
  const dot = useMemo(
    () => new MeshBasicMaterial({ color: ink, depthTest: false }),
    [ink]
  );
  useEffect(() => () => dot.dispose(), [dot]);
  return (
    <group>
      <Line
        color={ink}
        depthTest={false}
        lineWidth={1.2}
        opacity={0.7}
        points={[at, target]}
        renderOrder={LEADER}
        transparent
      />
      <mesh material={dot} position={target} renderOrder={LEADER}>
        <sphereGeometry args={[0.12, 12, 8]} />
      </mesh>
      <ThreeLabel
        anchorX={anchor[0]}
        anchorY={anchor[1]}
        color={ink}
        gap={0.25}
        position={at}
      >
        {children}
      </ThreeLabel>
    </group>
  );
}

/**
 * The way the blood leaves the fascicle: an arrow off the venous end of the
 * open groove's capillary, towards the veins and on to the liver, riding
 * with the back cut as the fibres shorten, with whatever names it.
 */
function Outflow({ children }: { readonly children: ReactNode }) {
  const pose = usePose();
  const group = useRef<Group>(null);

  useFrame(() => {
    const now = pose.current;
    group.current?.position.set(
      -FRONT * now.stretch + now.shift - 0.6,
      SHOWN[0] * now.swell,
      SHOWN[1] * now.swell
    );
  });

  return (
    <group position={[-FRONT - 0.6, SHOWN[0], SHOWN[1]]} ref={group}>
      <mesh position={[-2.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 4.4, 20]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={MUSCLE_COLORS.lactate}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[-5.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.62, 1.6, 28]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={MUSCLE_COLORS.lactate}
          roughness={0.4}
        />
      </mesh>
      {children}
    </group>
  );
}

/** A 50 µm bar standing below the front cut, clear of the tissue, to read sizes against. */
function ScaleBar() {
  const ink = useLabelInk();
  const length = BAR / MICRONS;
  return (
    <group position={[FRONT, -17.5, -6]}>
      <mesh position={[0, length / 2, 0]}>
        <boxGeometry args={[0.16, length, 0.16]} />
        <meshStandardMaterial color={ink} roughness={0.6} />
      </mesh>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        gap={0.5}
        position={[0, length / 2, -0.2]}
      >
        <InlineMath math={`${BAR}\\,\\mu\\text{m}`} />
      </ThreeLabel>
    </group>
  );
}

/**
 * Looks at the cut front and along the fibres from above and to the front. A
 * narrow card stands farther back and more nearly end on, so the length of
 * the fascicle and the outflow fit across it.
 */
function MuscleCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 90 : 72;
  const view = narrow
    ? ([0.74, 0.42, 0.52] as const)
    : ([0.62, 0.4, 0.68] as const);
  const target = narrow ? ([4, -3, 0] as const) : ([1, -2, 0] as const);
  return (
    <CameraControls
      cameraPosition={[
        target[0] + distance * view[0],
        target[1] + distance * view[1],
        target[2] + distance * view[2],
      ]}
      cameraTarget={target}
      fov={34}
      maxDistance={distance * 1.8}
      minDistance={4}
    />
  );
}
