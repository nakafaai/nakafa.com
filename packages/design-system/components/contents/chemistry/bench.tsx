import { RoundedBox } from "@react-three/drei";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import {
  type ReactNode,
  type Ref,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Vector2 } from "three";

/**
 * A school chemistry bench at real size, in metres: a dark epoxy worktop 0.9 m
 * deep on a pale cabinet, with a row of reagent bottles along its back edge.
 * The lab around it is the stage's `lab` setting. Experiments stand on the
 * worktop at y = 0.
 */
export function LabBench({ width = 2.4 }: { readonly width?: number }) {
  const bottles = Arr.map(Arr.range(0, 5), (index) => ({
    color: BOTTLE_GLASS[index % BOTTLE_GLASS.length],
    key: index,
    x: -width / 2 + 0.25 + index * 0.17,
  }));
  return (
    <group>
      <mesh position={[0, -0.025, 0]} receiveShadow>
        <boxGeometry args={[width, 0.05, 0.9]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          clearcoatRoughness={0.3}
          color={MATERIAL.epoxy}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[0, -0.47, 0.02]}>
        <boxGeometry args={[width - 0.04, 0.84, 0.86]} />
        <meshStandardMaterial color={MATERIAL.cabinet} roughness={0.6} />
      </mesh>
      {Arr.map(bottles, (bottle) => (
        <group key={bottle.key} position={[bottle.x, 0, -0.34]}>
          <mesh castShadow>
            <latheGeometry args={[BOTTLE_PROFILE, 28]} />
            <meshPhysicalMaterial
              clearcoat={1}
              color={bottle.color}
              roughness={0.15}
            />
          </mesh>
          <mesh position={[0, 0.165, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.025, 20]} />
            <meshStandardMaterial color={MATERIAL.bottleCap} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Amber, clear and green reagent glass. */
const BOTTLE_GLASS = [
  MATERIAL.bottleAmber,
  MATERIAL.bottleClear,
  MATERIAL.bottleGreen,
] as const;

/** A reagent bottle's outline, turned around its axis: body, shoulder, neck. */
const BOTTLE_PROFILE = Arr.map(
  [
    [0, 0],
    [0.045, 0],
    [0.048, 0.006],
    [0.048, 0.11],
    [0.04, 0.13],
    [0.02, 0.145],
    [0.018, 0.155],
    [0, 0.155],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/** What a simulation writes on the balance's display every frame. */
export interface ScaleRig {
  /** Shows `text` on the display, such as "101,14 g". */
  readonly show: (text: string) => void;
}

/**
 * A laboratory top-pan balance: a pale body, a stainless pan 0.2 m across on
 * top, and a display that a simulation writes through `ref` without
 * re-rendering React. Whatever stands on the pan goes in `children`.
 */
export function Scale({
  children,
  ref,
  unitLabel,
}: {
  readonly children?: ReactNode;
  readonly ref?: Ref<ScaleRig>;
  readonly unitLabel: string;
}) {
  const display = useRef<HTMLSpanElement>(null);

  useImperativeHandle(ref, () => ({
    show: (text) => {
      if (display.current && display.current.textContent !== text) {
        display.current.textContent = text;
      }
    },
  }));

  return (
    <group>
      <RoundedBox
        args={[0.3, 0.07, 0.34]}
        castShadow
        position={[0, 0.035, 0]}
        radius={0.02}
        receiveShadow
      >
        <meshStandardMaterial color={MATERIAL.balanceBody} roughness={0.45} />
      </RoundedBox>
      <mesh position={[0, 0.05, 0.171]}>
        <boxGeometry args={[0.13, 0.034, 0.004]} />
        <meshStandardMaterial
          color={MATERIAL.lcd}
          emissive={MATERIAL.lcdGlow}
          emissiveIntensity={0.6}
          roughness={0.25}
        />
      </mesh>
      <ThreeLabel
        color={MATERIAL.lcdInk}
        fontSize="compact"
        outlineColor={MATERIAL.lcdHalo}
        outlineWidth={0.003}
        position={[0, 0.05, 0.176]}
      >
        <span className="font-mono tabular-nums" ref={display} />{" "}
        <span className="font-mono">{unitLabel}</span>
      </ThreeLabel>
      <mesh castShadow position={[0, 0.08, -0.02]}>
        <cylinderGeometry args={[0.1, 0.1, 0.008, 48]} />
        <MetalMaterial color={MATERIAL.panSteel} roughness={0.38} />
      </mesh>
      <group position={[0, 0.084, -0.02]}>{children}</group>
    </group>
  );
}

/** An outline turned around a vertical axis, from its radii at each height. */
function profile(points: readonly (readonly [number, number])[]) {
  return Arr.map(points, ([radius, height]) => new Vector2(radius, height));
}

/** A 250 mL conical (Erlenmeyer) flask: its outer wall, base to rim, in metres. */
const FLASK_WALL = profile([
  [0.001, 0],
  [0.04, 0],
  [0.043, 0.004],
  [0.043, 0.012],
  [0.018, 0.105],
  [0.016, 0.112],
  [0.016, 0.145],
  [0.018, 0.147],
]);

/** The radius of the flask's inside at height `y`, for the liquid it holds. */
export function flaskRadiusAt(y: number) {
  if (y <= 0.012) {
    return 0.04;
  }
  if (y >= 0.105) {
    return 0.014;
  }
  return 0.04 - ((y - 0.012) / (0.105 - 0.012)) * (0.04 - 0.016);
}

/** A conical flask of clear glass. */
export function Flask() {
  return (
    <mesh castShadow>
      <latheGeometry args={[FLASK_WALL, 48]} />
      <GlassMaterial color={MATERIAL.glass} opacity={0.28} />
    </mesh>
  );
}

/**
 * The liquid in a conical flask, filled to `level` metres: the flask's
 * inside, turned up to the surface.
 */
export function FlaskLiquid({
  color,
  level,
}: {
  readonly color: string;
  readonly level: number;
}) {
  const points = useMemo(
    () =>
      profile([
        [0.001, 0.003],
        ...Arr.map(Arr.range(0, 8), (step) => {
          const y = 0.003 + ((level - 0.003) * step) / 8;
          return [flaskRadiusAt(y) - 0.002, y] as const;
        }),
        [0.001, level],
      ]),
    [level]
  );
  return (
    <mesh>
      <latheGeometry args={[points, 40]} />
      <LiquidMaterial color={color} opacity={0.72} />
    </mesh>
  );
}

/** A 100 mL beaker, 50 mm across and 70 mm tall, of clear glass. */
const BEAKER_WALL = profile([
  [0.001, 0],
  [0.025, 0],
  [0.0265, 0.003],
  [0.0265, 0.07],
  [0.028, 0.072],
]);

/** A beaker of clear glass. */
export function Beaker() {
  return (
    <mesh castShadow>
      <latheGeometry args={[BEAKER_WALL, 40]} />
      <GlassMaterial color={MATERIAL.glass} opacity={0.26} />
    </mesh>
  );
}
