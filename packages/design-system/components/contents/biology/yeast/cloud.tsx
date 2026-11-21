import { useFrame } from "@react-three/fiber";
import {
  carbonDioxideOut,
  DELIVERY,
  gasFlow,
  gasOut,
  molarVolume,
} from "@repo/design-system/components/contents/biology/yeast/ferment";
import {
  GAP,
  useLimewater,
} from "@repo/design-system/components/contents/biology/yeast/fill";
import {
  bubbleGrowth,
  bubbleRate,
  bubbleRisen,
  bubbleVolume,
  chalkAt,
  LIMEWATER,
  milkiness,
  OUTLET,
  outletDepth,
  sphereDiameter,
} from "@repo/design-system/components/contents/biology/yeast/limewater";
import { useRun } from "@repo/design-system/components/contents/biology/yeast/run";
import {
  innerRadius,
  levelOf,
  TEST_TUBE,
} from "@repo/design-system/components/contents/biology/yeast/tube";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { YEAST_COLORS } from "@repo/design-system/lib/material/yeast";
import { Array as Arr } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh, Mesh } from "three";
import { Color, MeshPhysicalMaterial, Object3D } from "three";

/** The flecks of chalk the limewater can show; how many show follows its milkiness. */
const FLECKS = 150;

/** How much of the light clear limewater lets through its glass, and milky limewater. */
const CLEAR_OPACITY = 0.16;
const MILKY_OPACITY = 0.94;

/**
 * The limewater in its test tube, standing on the tube's foot at the origin.
 * Fed by the yeast tube (`fed`), it clouds as calcium carbonate comes out of
 * it: the liquid turns from water-clear to a dense white, and flecks of chalk
 * fill it. A bubble swells on the delivery tube's end at the pace gas
 * leaves and, once free, squeezes up past the tube to the surface. The
 * control's limewater never sees a bubble and stays clear.
 */
export function Limewater({ fed }: { readonly fed: boolean }) {
  const run = useRun();
  const geometry = useLimewater(TEST_TUBE, LIMEWATER);
  const flecks = useRef<InstancedMesh>(null);
  const swelling = useRef<Mesh>(null);
  const rising = useRef<Mesh>(null);
  const radius = innerRadius(TEST_TUBE) - GAP;
  const floor = TEST_TUBE.wall;
  const surface = floor + levelOf(TEST_TUBE, LIMEWATER);
  const outlet = floor + OUTLET;
  const bubble = sphereDiameter(bubbleVolume()) / 2;
  const tint = useMemo(
    () => ({
      chalk: new Color(YEAST_COLORS.chalk),
      clear: new Color(YEAST_COLORS.limewater),
    }),
    []
  );
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
        color: YEAST_COLORS.limewater,
        depthWrite: false,
        ior: 1.33,
        opacity: CLEAR_OPACITY,
        roughness: 0.15,
        transparent: true,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);

  useLayoutEffect(() => {
    const mesh = flecks.current;
    if (mesh === null) {
      return;
    }
    const holder = new Object3D();
    Arr.forEach(Arr.range(0, FLECKS - 1), (index) => {
      const turn = hashUnit(index, 29) * Math.PI * 2;
      const inner = DELIVERY.outer + 0.0005;
      const out =
        inner + Math.sqrt(hashUnit(index, 31)) * (radius - 0.0005 - inner);
      const low = TEST_TUBE.diameter / 2;
      holder.position.set(
        Math.sin(turn) * out,
        low + hashUnit(index, 37) * (surface - low - 0.0008),
        Math.cos(turn) * out
      );
      holder.scale.setScalar(0.000_12 + 0.000_16 * hashUnit(index, 41));
      holder.updateMatrix();
      mesh.setMatrixAt(index, holder.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = 0;
  });

  useFrame(() => {
    const minutes = run.clock.current;
    const gas = fed ? gasOut(run.celsius, run.percent, minutes) : 0;
    const delivered = carbonDioxideOut(gas) / molarVolume(run.celsius);
    const cloud = milkiness(chalkAt(delivered));
    material.opacity = CLEAR_OPACITY + (MILKY_OPACITY - CLEAR_OPACITY) * cloud;
    material.color.lerpColors(tint.clear, tint.chalk, cloud);
    if (flecks.current !== null) {
      flecks.current.count = Math.round(FLECKS * cloud);
    }
    const rate = fed
      ? bubbleRate(gasFlow(run.celsius, run.percent, minutes))
      : 0;
    const growth = bubbleGrowth(rate, run.seconds.current);
    const risen = bubbleRisen(rate, run.seconds.current);
    const swell = swelling.current;
    if (swell !== null) {
      const size = bubble * Math.cbrt(growth);
      swell.visible = growth > 0;
      swell.scale.setScalar(Math.max(size, 1e-5));
      swell.position.set(0, outlet - size, 0);
    }
    const free = rising.current;
    if (free !== null) {
      free.visible = risen < outletDepth();
      free.position.set(0, outlet + Math.min(risen, outletDepth()), 0);
    }
  });

  return (
    <group>
      <instancedMesh args={[undefined, undefined, FLECKS]} ref={flecks}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={YEAST_COLORS.chalk} roughness={0.8} />
      </instancedMesh>
      <mesh ref={swelling} visible={false}>
        <sphereGeometry args={[1, 20, 14]} />
        <BubbleMaterial />
      </mesh>
      <group ref={rising} visible={false}>
        <mesh
          position={[0, 0, DELIVERY.outer + 0.0021]}
          scale={[0.0028, 0.0042, 0.0019]}
        >
          <sphereGeometry args={[1, 20, 14]} />
          <BubbleMaterial />
        </mesh>
      </group>
      <mesh geometry={geometry} material={material} renderOrder={1} />
    </group>
  );
}

/** A gas bubble in water: a bright, glassy skin that catches the light. */
function BubbleMaterial() {
  return (
    <meshPhysicalMaterial
      clearcoat={1}
      clearcoatRoughness={0.02}
      color={YEAST_COLORS.chalk}
      ior={1}
      opacity={0.72}
      roughness={0.04}
      transparent
    />
  );
}
