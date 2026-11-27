import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { prepareFaunaScene } from "@repo/design-system/components/contents/biology/fauna";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { Array as Arr, Option } from "effect";
import { useMemo, useRef } from "react";
import type { Group, Object3D } from "three";
import { Box3, Euler, Mesh, Quaternion, Vector3 } from "three";
import { clone as cloneRig } from "three/examples/jsm/utils/SkeletonUtils.js";

const BREATH_RATE = 1.7;
const TURN = new Quaternion();
const ANGLES = new Euler();

/**
 * An open-source specimen mesh standing on the ground at `y = 0`, its longest
 * side scaled to `extent` and turned by `heading` so it faces along `+x`. While
 * the card plays it breathes: the flanks rise and fall and its weight shifts.
 */
export function LivingSpecimen({
  extent,
  heading,
  path,
  phase = 0,
}: {
  readonly extent: number;
  readonly heading: number;
  readonly path: string;
  readonly phase?: number;
}) {
  const { scene } = useGLTF(path);
  const model = useMemo(
    () =>
      prepareFaunaScene(scene, { groundBottom: true, targetExtent: extent }),
    [extent, scene]
  );
  const body = useRef<Group>(null);
  const time = useRef(phase);

  useFrame((_, delta) => {
    if (!body.current) {
      return;
    }
    time.current += simulationStep(delta);
    const breath = Math.sin(time.current * BREATH_RATE);
    body.current.scale.set(1 + breath * 0.007, 1 + breath * 0.011, 1);
    body.current.rotation.x = Math.sin(time.current * 0.55) * 0.014;
  });

  return (
    <group rotation={[0, heading, 0]}>
      <group ref={body}>
        <primitive object={model} />
      </group>
    </group>
  );
}

/** How far each kind of joint of a rigged specimen swings, in radians, and how fast. */
const JOINT_MOTION = [
  { amount: 0.07, match: /Head_\d+$/u, rate: 0.5 },
  { amount: 0.04, match: /Neck_\d+$/u, rate: 0.5 },
  { amount: 0.09, match: /Tail\d?_\d+$/u, rate: 1.1 },
  { amount: 0.012, match: /Spine1_\d+$/u, rate: BREATH_RATE },
] as const;

/** Clones a rigged model with its own skeleton, grounds it and scales its longest side to `extent`. */
function prepareRig(source: Object3D, extent: number) {
  const rig = cloneRig(source);
  rig.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(rig, true);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const scale = extent / Math.max(size.x, size.y, size.z, 1e-6);
  rig.scale.multiplyScalar(scale);
  rig.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);

  const nodes = descendantsOf(rig);
  Arr.forEach(nodes, (child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;
    }
  });
  const joints = Arr.getSomes(
    Arr.map(nodes, (child) =>
      Option.map(
        Arr.findFirst(JOINT_MOTION, (entry) => entry.match.test(child.name)),
        (motion) => ({
          amount: motion.amount,
          joint: child,
          rate: motion.rate,
          rest: child.quaternion.clone(),
        })
      )
    )
  );
  return { joints, rig };
}

/** Every object under `root`, parents before their children. */
function descendantsOf(root: Object3D): readonly Object3D[] {
  return Arr.flatMap(root.children, (child) => [
    child,
    ...descendantsOf(child),
  ]);
}

/**
 * A rigged open-source specimen standing in the pose its skeleton rests in.
 * While the card plays its head turns, its tail sways and its chest breathes,
 * each joint swinging a little around the pose it rests in.
 */
export function RiggedSpecimen({
  extent,
  heading,
  path,
}: {
  readonly extent: number;
  readonly heading: number;
  readonly path: string;
}) {
  const { scene } = useGLTF(path);
  const { joints, rig } = useMemo(
    () => prepareRig(scene, extent),
    [extent, scene]
  );
  const time = useRef(0);

  useFrame((_, delta) => {
    time.current += simulationStep(delta);
    Arr.forEach(joints, (entry, index) => {
      const swing = Math.sin(time.current * entry.rate + index * 0.9);
      ANGLES.set(swing * entry.amount * 0.4, swing * entry.amount, 0);
      entry.joint.quaternion
        .copy(entry.rest)
        .multiply(TURN.setFromEuler(ANGLES));
    });
  });

  return (
    <group rotation={[0, heading, 0]}>
      <primitive object={rig} />
    </group>
  );
}
