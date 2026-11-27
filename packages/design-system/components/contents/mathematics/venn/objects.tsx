import { RoundedBox } from "@react-three/drei";
import {
  PlasticBall,
  SteelBall,
  TennisBall,
} from "@repo/design-system/components/contents/mathematics/venn/balls";
import type { VennObject } from "@repo/design-system/components/contents/mathematics/venn/sets";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { VENN_COLORS } from "@repo/design-system/lib/material/venn";
import { Array as Arr, Match } from "effect";
import { useMemo } from "react";
import { LatheGeometry, Vector2 } from "three";

/**
 * The everyday objects of the set-sorting lab, each at its real size in
 * metres and standing on y = 0, so the scene sets any of them down on the
 * mat or the tray without knowing its shape. None is wider than 9 cm.
 */

/** How far each object reaches from its middle across the floor, in metres. */
export const OBJECT_REACH: Readonly<Record<VennObject, number>> = {
  apple: 0.037,
  "blue-ball": 0.035,
  "blue-cup": 0.04,
  coin: 0.0122,
  "green-block": 0.033,
  "green-cup": 0.04,
  lemon: 0.035,
  lime: 0.028,
  "red-ball": 0.035,
  "red-block": 0.033,
  "steel-ball": 0.02,
  "tennis-ball": 0.0335,
  "toy-car": 0.043,
  washer: 0.025,
  "yellow-block": 0.033,
};

/** Turns an outline of radius and height pairs into a solid of revolution. */
function useLathe(outline: readonly (readonly [number, number])[]) {
  return useMemo(
    () =>
      new LatheGeometry(
        Arr.map(outline, ([radius, height]) => new Vector2(radius, height)),
        48
      ),
    [outline]
  );
}

/** A red apple, 7.4 cm across, with its stem and one leaf. */
const APPLE_OUTLINE = [
  [0, 0.006],
  [0.01, 0.001],
  [0.024, 0.004],
  [0.034, 0.016],
  [0.037, 0.032],
  [0.034, 0.048],
  [0.024, 0.059],
  [0.01, 0.06],
  [0, 0.055],
] as const;

function Apple() {
  const geometry = useLathe(APPLE_OUTLINE);
  return (
    <group>
      <mesh castShadow geometry={geometry} receiveShadow>
        <Matter color={VENN_COLORS.apple} of="wax" />
      </mesh>
      <mesh position={[0.001, 0.062, 0]} rotation={[0, 0, -0.25]}>
        <cylinderGeometry args={[0.0012, 0.0016, 0.014, 8]} />
        <Matter color={VENN_COLORS.stem} of="cork" />
      </mesh>
      <mesh
        position={[0.008, 0.064, 0.002]}
        rotation={[0.3, 0.4, -0.9]}
        scale={[1, 0.18, 0.5]}
      >
        <sphereGeometry args={[0.009, 12, 8]} />
        <SurfaceMaterial
          color={VENN_COLORS.leaf}
          roughness={0.9}
          surface="leaf"
        />
      </mesh>
    </group>
  );
}

/** A citrus fruit lying on its side: its peel pitted with oil glands. */
function Citrus({
  color,
  length,
  radius,
}: {
  readonly color: string;
  readonly length: number;
  readonly radius: number;
}) {
  return (
    <mesh
      castShadow
      position={[0, radius, 0]}
      receiveShadow
      scale={[length / (2 * radius), 1, 1]}
    >
      <sphereGeometry args={[radius, 40, 24]} />
      <Matter color={color} of="rubber" />
    </mesh>
  );
}

/** A flat steel washer, 5 cm across, 3 mm thick, as one closed ring outline. */
const WASHER_OUTLINE = [
  [0.011, 0],
  [0.025, 0],
  [0.025, 0.003],
  [0.011, 0.003],
  [0.011, 0],
] as const;

function Washer() {
  const geometry = useLathe(WASHER_OUTLINE);
  return (
    <mesh castShadow geometry={geometry} receiveShadow>
      <Matter of="steel" />
    </mesh>
  );
}

/** A silver coin, 2.4 cm across. */
function Coin() {
  return (
    <mesh castShadow position={[0, 0.0009, 0]} receiveShadow>
      <cylinderGeometry args={[0.0122, 0.0122, 0.0018, 40]} />
      <Matter finish="polished" of="nickel" />
    </mesh>
  );
}

/** A die-cast toy car, 8 cm long: a painted body, tinted cabin, black tyres. */
function ToyCar() {
  const wheels = [
    [-0.025, 0.0165],
    [-0.025, -0.0165],
    [0.025, 0.0165],
    [0.025, -0.0165],
  ] as const;
  return (
    <group rotation={[0, 0.5, 0]}>
      <RoundedBox
        args={[0.08, 0.016, 0.032]}
        castShadow
        position={[0, 0.014, 0]}
        radius={0.004}
        receiveShadow
      >
        <Matter color={VENN_COLORS.car} of="enamel" />
      </RoundedBox>
      <RoundedBox
        args={[0.038, 0.013, 0.028]}
        castShadow
        position={[-0.004, 0.027, 0]}
        radius={0.004}
      >
        <Matter color={VENN_COLORS.window} of="epoxy" />
      </RoundedBox>
      {Arr.map(wheels, ([x, z]) => (
        <group key={`${x}-${z}`} position={[x, 0.0075, z]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0075, 0.0075, 0.006, 20]} />
            <Matter of="rubber" />
          </mesh>
          <mesh
            position={[0, 0, Math.sign(z) * 0.0031]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.0038, 0.0038, 0.0004, 16]} />
            <Matter of="chrome" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A painted wooden building block, a 5 cm cube with eased edges. */
function Block({ color }: { readonly color: string }) {
  return (
    <RoundedBox
      args={[0.05, 0.05, 0.05]}
      castShadow
      position={[0, 0.025, 0]}
      radius={0.003}
      receiveShadow
      rotation={[0, 0.3, 0]}
    >
      <Matter color={color} of="lacquer" />
    </RoundedBox>
  );
}

/** A plastic tumbler, 9 cm tall and 8 cm across the rim, as one closed outline with a 2 mm wall. */
const CUP_OUTLINE = [
  [0, 0],
  [0.025, 0],
  [0.027, 0.002],
  [0.04, 0.09],
  [0.038, 0.09],
  [0.025, 0.004],
  [0, 0.004],
] as const;

function Cup({ color }: { readonly color: string }) {
  const geometry = useLathe(CUP_OUTLINE);
  return (
    <mesh castShadow geometry={geometry} receiveShadow>
      <Matter color={color} of="enamel" />
    </mesh>
  );
}

/** Draws one object of the lab, standing on y = 0. */
export function VennObjectModel({ object }: { readonly object: VennObject }) {
  return Match.value(object).pipe(
    Match.when("apple", () => <Apple />),
    Match.when("lemon", () => (
      <Citrus color={VENN_COLORS.lemon} length={0.07} radius={0.026} />
    )),
    Match.when("lime", () => (
      <Citrus color={VENN_COLORS.lime} length={0.056} radius={0.025} />
    )),
    Match.when("tennis-ball", () => <TennisBall />),
    Match.when("steel-ball", () => <SteelBall />),
    Match.when("red-ball", () => <PlasticBall color={VENN_COLORS.redBall} />),
    Match.when("blue-ball", () => <PlasticBall color={VENN_COLORS.blueBall} />),
    Match.when("washer", () => <Washer />),
    Match.when("coin", () => <Coin />),
    Match.when("toy-car", () => <ToyCar />),
    Match.when("red-block", () => <Block color={VENN_COLORS.redBlock} />),
    Match.when("green-block", () => <Block color={VENN_COLORS.greenBlock} />),
    Match.when("yellow-block", () => <Block color={VENN_COLORS.yellowBlock} />),
    Match.when("blue-cup", () => <Cup color={VENN_COLORS.blueCup} />),
    Match.when("green-cup", () => <Cup color={VENN_COLORS.greenCup} />),
    Match.exhaustive
  );
}
