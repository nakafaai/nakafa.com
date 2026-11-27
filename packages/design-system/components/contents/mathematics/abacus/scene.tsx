import { useFrame, useThree } from "@react-three/fiber";
import {
  BeadLacquer,
  BeadPot,
  Board,
  PLACE_COLORS,
  useLathe,
} from "@repo/design-system/components/contents/mathematics/abacus/desk";
import {
  incrementFrame,
  incrementPlan,
  planDuration,
} from "@repo/design-system/components/contents/mathematics/abacus/motion";
import {
  nextValue,
  PLACES,
} from "@repo/design-system/components/contents/mathematics/abacus/place";
import {
  slotY,
  spikeX,
} from "@repo/design-system/components/contents/mathematics/abacus/rig";
import { beadProfile } from "@repo/design-system/components/contents/mathematics/abacus/shape";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { Array as Arr } from "effect";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Object3D } from "three";

/** The most beads of one place drawn at once: a full spike of ten and a stack of ten in the air. */
const MOST_BEADS = 20;

/** How long a finished count rests before the next bead comes, in seconds. */
const REST = 0.35;

/**
 * A classroom spike abacus on a school desk, showing `value` in `base`.
 * While the card plays it adds one bead at a time: each bead comes out of
 * the pot onto the units spike, and every spike it fills carries its stack
 * back to the pot and sends one bead to the spike on its left. When one
 * count ends, `onStep` receives the next number.
 */
export function AbacusScene({
  base,
  onStep,
  value,
}: {
  readonly base: number;
  readonly onStep: (next: number) => void;
  readonly value: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const beadGeometry = useLathe(useMemo(beadProfile, []), 40);
  const meshes = useRef<(InstancedMesh | null)[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  const plan = useMemo(() => incrementPlan(value, base), [base, value]);
  const count = useRef({
    duration: planDuration(plan),
    stepped: false,
    time: 0,
  });

  // A new number, set on the slider or reached by the count, starts adding one from its beginning.
  useLayoutEffect(() => {
    count.current = { duration: planDuration(plan), stepped: false, time: 0 };
    invalidate();
  }, [invalidate, plan]);

  useFrame((_, delta) => {
    const current = count.current;
    if (playing && !current.stepped) {
      current.time += simulationStep(delta);
      if (current.time >= current.duration + REST) {
        current.stepped = true;
        onStep(nextValue(value, base));
      }
    }
    const frame = incrementFrame(
      value,
      base,
      Math.min(current.time, current.duration)
    );
    Arr.forEach(Arr.range(0, PLACES - 1), (place) => {
      const mesh = meshes.current[place];
      if (!mesh) {
        return;
      }
      const resting = Arr.map(
        Arr.take(Arr.range(0, MOST_BEADS - 1), frame.resting[place] ?? 0),
        (slot) => ({ x: spikeX(place), y: slotY(slot) })
      );
      const moving = Arr.filter(frame.moving, (pose) => pose.place === place);
      const shown = Arr.take([...resting, ...moving], MOST_BEADS);
      Arr.forEach(shown, (bead, index) => {
        dummy.position.set(bead.x, bead.y, 0);
        dummy.rotation.set(0, index * 0.7, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.count = shown.length;
      mesh.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <AbacusCamera />
      <Board base={base} />
      <BeadPot />
      {Arr.map(PLACE_COLORS, (color, place) => (
        <instancedMesh
          args={[beadGeometry, undefined, MOST_BEADS]}
          castShadow
          frustumCulled={false}
          key={color}
          receiveShadow
          ref={(mesh) => {
            meshes.current[place] = mesh;
          }}
        >
          <BeadLacquer color={color} />
        </instancedMesh>
      ))}
    </group>
  );
}

/**
 * How far the camera may swing round either side of the front, in radians,
 * by the learner's hand or while the count plays: about 29 degrees, so the
 * spikes never hide each other and every place plate stays in view.
 */
const TURN_LIMIT = 0.5;

/** Where the camera looks on a wide card: between the abacus and the pot. */
const TARGET = [0.064, 0.105, 0] as const;

/**
 * Looks at the abacus and the pot from in front and a little above, so the
 * beads show their tops; on a narrow card, farther back and turned toward
 * the abacus, so its place-value card stays readable and the pot sits at the
 * edge.
 */
function AbacusCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 0.64 : 0.54;
  const elevation = 0.3;
  const target = narrow ? ([0.03, 0.095, 0.02] as const) : TARGET;
  return (
    <CameraControls
      cameraPosition={[
        target[0],
        target[1] + distance * Math.sin(elevation),
        distance * Math.cos(elevation),
      ]}
      cameraTarget={target}
      fov={36}
      maxAzimuthAngle={TURN_LIMIT}
      maxDistance={distance * 1.8}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minAzimuthAngle={-TURN_LIMIT}
      minDistance={0.18}
    />
  );
}
