import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  Cristae,
  CristaProteins,
} from "@repo/design-system/components/contents/biology/mitochondrion/cristae";
import { Cytoplasm } from "@repo/design-system/components/contents/biology/mitochondrion/cytoplasm";
import type { Part } from "@repo/design-system/components/contents/biology/mitochondrion/labels";
import { LABELS } from "@repo/design-system/components/contents/biology/mitochondrion/labels";
import { MatrixBodies } from "@repo/design-system/components/contents/biology/mitochondrion/matrix";
import { Membranes } from "@repo/design-system/components/contents/biology/mitochondrion/membranes";
import { Molecules } from "@repo/design-system/components/contents/biology/mitochondrion/molecules";
import type {
  Cell,
  Condition,
} from "@repo/design-system/components/contents/biology/mitochondrion/respiration";
import {
  CYCLE,
  MoleculeSchema,
  STILL,
  tripsOf,
} from "@repo/design-system/components/contents/biology/mitochondrion/respiration";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { Vector3 } from "three";

/**
 * A stretch of cytoplasm with one mitochondrion cut open lengthwise, at the
 * scale of an electron micrograph (one unit is one micrometre), and the
 * molecules of respiration moving through it: glucose split into pyruvate in
 * the cytoplasm and, with oxygen, pyruvate entering the matrix, carbon
 * dioxide leaving, hydrogen and oxygen meeting at the cristae as water, and
 * ATP leaving the inner membrane. Without oxygen the organelle goes quiet
 * and pyruvate becomes lactic acid, or ethanol and carbon dioxide, in the
 * cytoplasm. Three glucose journeys run a third of a cycle apart, so the
 * still frame shows every stage at once. `children` draws over it, such as
 * the part labels.
 */
export function MitochondrionScene({
  atp,
  cell,
  children,
  condition,
}: {
  readonly atp: number;
  readonly cell: Cell;
  readonly children: ReactNode;
  readonly condition: Condition;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(STILL * CYCLE);
  const trips = useMemo(() => tripsOf(condition, atp), [atp, condition]);

  useFrame((_, delta) => {
    if (playing) {
      clock.current = (clock.current + simulationStep(delta)) % CYCLE;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <MitochondrionCamera />
      <Membranes />
      <Cristae />
      <CristaProteins active={condition === "aerobic"} />
      <MatrixBodies />
      <Cytoplasm cell={cell} />
      {Arr.map(MoleculeSchema.literals, (molecule) => (
        <Molecules
          clock={clock}
          key={molecule}
          molecule={molecule}
          trips={Arr.filter(trips, (trip) => trip.molecule === molecule)}
        />
      ))}
      {children}
    </group>
  );
}

/**
 * How squarely the camera must look into the cut for the part labels to
 * show: the share of its view that points into the cut. Turned end on or
 * round behind, the labels would stack up and point at parts out of sight.
 */
const FACING = 0.4;

/** Whether the camera looks into the cut, kept as state that changes only when it turns past `FACING`. */
function useFacingCut() {
  const [facing, setFacing] = useState(true);
  const view = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const now = -camera.getWorldDirection(view).z > FACING;
    if (now !== facing) {
      setFacing(now);
    }
  });
  return facing;
}

/** The part labels, each joined by a thin leader to the part it names, shown while the camera looks into the cut. */
export function PartLabels({
  parts,
}: {
  readonly parts: Readonly<Record<Part, string>>;
}) {
  const ink = useLabelInk();
  const facing = useFacingCut();
  return (
    <group>
      {Arr.map(LABELS, ({ anchor, at, part, target }) => (
        <group key={part}>
          {target === undefined ? null : (
            <Line
              color={ink}
              lineWidth={1.2}
              opacity={0.75}
              points={[at, target]}
              transparent
              visible={facing}
            />
          )}
          <ThreeLabel
            anchorX={anchor[0]}
            anchorY={anchor[1]}
            color={ink}
            fontSize="compact"
            position={at}
            visible={facing}
          >
            {parts[part]}
          </ThreeLabel>
        </group>
      ))}
    </group>
  );
}

/** Looks into the cut organelle from the front, above and to the right, so the cristae show their faces; farther back on a square card. */
function MitochondrionCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 5.4 : 3.9;
  return (
    <CameraControls
      cameraPosition={[
        distance * 0.42,
        0.22 + distance * 0.38,
        distance * 0.82,
      ]}
      cameraTarget={[0, 0.2, -0.1]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={0.8}
    />
  );
}
