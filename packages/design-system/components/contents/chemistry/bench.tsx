import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { Array as Arr } from "effect";
import type { ReactNode, Ref } from "react";
import { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { ExtrudeGeometry, Shape, Vector2 } from "three";

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
          color={BENCH_COLORS.epoxy}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[0, -0.47, 0.02]}>
        <boxGeometry args={[width - 0.04, 0.84, 0.86]} />
        <meshStandardMaterial color={BENCH_COLORS.cabinet} roughness={0.6} />
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
            <meshStandardMaterial
              color={BENCH_COLORS.bottleCap}
              roughness={0.6}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Amber, clear and green reagent glass. */
const BOTTLE_GLASS = [
  BENCH_COLORS.bottleAmber,
  BENCH_COLORS.bottleClear,
  BENCH_COLORS.bottleGreen,
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
  reading,
  ref,
  unitLabel,
}: {
  readonly children?: ReactNode;
  readonly reading?: ReactNode;
  readonly ref?: Ref<ScaleRig>;
  readonly unitLabel?: string;
}) {
  const display = useRef<HTMLSpanElement>(null);

  useImperativeHandle(ref, () => ({
    show: (text) => {
      if (display.current && display.current.textContent !== text) {
        display.current.textContent = text;
      }
    },
  }));

  const body = useMemo(createBalanceBody, []);
  useEffect(() => () => body.dispose(), [body]);

  return (
    <group>
      {Arr.map(BALANCE.feet, ([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.003, z]}>
          <cylinderGeometry args={[0.012, 0.014, 0.006, 16]} />
          <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.8} />
        </mesh>
      ))}
      <mesh
        castShadow
        geometry={body}
        position={[0, 0.012, 0]}
        receiveShadow
        rotation={[0, -Math.PI / 2, 0]}
      >
        <meshStandardMaterial
          color={BENCH_COLORS.balanceBody}
          roughness={0.6}
        />
      </mesh>
      <group position={BALANCE.panel} rotation={[BALANCE.slope, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.15, 0.004, 0.042]} />
          <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.5} />
        </mesh>
        <mesh position={[-0.02, 0.0025, 0]}>
          <boxGeometry args={[0.09, 0.002, 0.028]} />
          <meshStandardMaterial
            color={BENCH_COLORS.lcd}
            emissive={BENCH_COLORS.lcdGlow}
            emissiveIntensity={0.6}
            roughness={0.2}
          />
        </mesh>
        {Arr.map([0.045, 0.062] as const, (x) => (
          <mesh key={x} position={[x, 0.003, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.004, 16]} />
            <meshStandardMaterial
              color={BENCH_COLORS.balanceKey}
              roughness={0.5}
            />
          </mesh>
        ))}
        <ThreeLabel
          color={BENCH_COLORS.lcdInk}
          fontSize="compact"
          outlineColor={BENCH_COLORS.lcdHalo}
          outlineWidth={0.003}
          position={[-0.02, 0.006, 0]}
        >
          {reading ?? (
            <>
              <span className="font-mono tabular-nums" ref={display} />{" "}
              <span className="font-mono">{unitLabel}</span>
            </>
          )}
        </ThreeLabel>
      </group>
      <mesh castShadow position={[0, 0.095, BALANCE.pan]}>
        <cylinderGeometry args={[0.1, 0.098, 0.006, 64]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.098, BALANCE.pan]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.099, 0.002, 8, 64]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.25} />
      </mesh>
      <group position={[0, 0.098, BALANCE.pan]}>{children}</group>
    </group>
  );
}

/**
 * A top-loading laboratory balance, 30 cm wide and 34 cm deep: a flat back
 * that carries the pan and a front sloped toward the user for the display and
 * the keys. The side profile is drawn in the depth and height plane, front at
 * +0.17 m, and extruded across the width.
 */
const BALANCE = {
  feet: [
    [0.12, 0.14],
    [-0.12, 0.14],
    [0.12, -0.14],
    [-0.12, -0.14],
  ],
  pan: -0.035,
  panel: [0, 0.07, 0.122],
  slope: 0.43,
} as const;

/** The balance's housing: its side profile extruded 30 cm across, edges rounded. */
function createBalanceBody() {
  const side = new Shape();
  side.moveTo(-0.17, 0);
  side.lineTo(0.17, 0);
  side.lineTo(0.17, 0.03);
  side.lineTo(0.075, 0.074);
  side.lineTo(-0.17, 0.074);
  side.closePath();
  const geometry = new ExtrudeGeometry(side, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    depth: 0.288,
  });
  geometry.translate(0, 0, -0.144);
  return geometry;
}

/** An outline turned around a vertical axis, from its radii at each height. */
function profile(points: readonly (readonly [number, number])[]) {
  return Arr.map(points, ([radius, height]) => new Vector2(radius, height));
}

/** How high water climbs the glass where it meets the wall, about 1.5 mm. */
const MENISCUS_RISE = 0.0015;

/** How far in from the wall the curve of the meniscus reaches, at most. */
const MENISCUS_REACH = 0.004;

/** How thick the wall of school glassware is, about 1.5 mm. */
export const GLASS_WALL = 0.0015;

/**
 * The surface of a liquid in glass, as lathe points from the wall inward:
 * water wets glass, so its surface climbs the wall in a concave meniscus and
 * lies flat in the middle, where a reading is taken.
 */
function meniscus(radius: number, level: number) {
  const reach = Math.min(MENISCUS_REACH, radius * 0.6);
  return Arr.map(Arr.range(0, 6), (step) => {
    const share = step / 6;
    return [
      radius - share * reach,
      level + MENISCUS_RISE * (1 - share) ** 2,
    ] as const;
  });
}

/**
 * A liquid standing in a straight glass, a beaker or a burette, from
 * `bottom` up to `level` metres, its surface curved into a meniscus.
 */
export function ColumnLiquid({
  bottom,
  color,
  level,
  opacity,
  radius,
}: {
  readonly bottom: number;
  readonly color: string;
  readonly level: number;
  readonly opacity: number;
  readonly radius: number;
}) {
  const points = useMemo(
    () =>
      profile([
        [0.0005, bottom],
        [radius, bottom],
        ...meniscus(radius, level),
        [0.0005, level],
      ]),
    [bottom, level, radius]
  );
  return (
    <mesh>
      <latheGeometry args={[points, 48]} />
      <LiquidMaterial color={color} opacity={opacity} />
    </mesh>
  );
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

/**
 * A conical flask of clear borosilicate glass. It stays transparent rather
 * than transmissive: three.js leaves transparent objects out of the scene a
 * transmissive surface refracts, so the liquid inside would vanish.
 */
export function Flask() {
  return (
    <mesh castShadow>
      <latheGeometry args={[FLASK_WALL, 64]} />
      <GlassMaterial color={BENCH_COLORS.glass} />
    </mesh>
  );
}

/**
 * The liquid in a conical flask, filled to `level` metres: the flask's
 * inside, turned up to a surface that climbs the glass in a meniscus.
 */
export function FlaskLiquid({
  color,
  level,
  opacity = 0.72,
}: {
  readonly color: string;
  readonly level: number;
  readonly opacity?: number;
}) {
  const points = useMemo(
    () =>
      profile([
        [0.001, 0.003],
        ...Arr.map(Arr.range(0, 7), (step) => {
          const y = 0.003 + ((level - 0.003) * step) / 8;
          return [flaskRadiusAt(y) - 0.002, y] as const;
        }),
        ...meniscus(flaskRadiusAt(level) - 0.002, level),
        [0.001, level],
      ]),
    [level]
  );
  return (
    <mesh>
      <latheGeometry args={[points, 40]} />
      <LiquidMaterial color={color} opacity={opacity} />
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

/** A beaker of clear borosilicate glass. */
export function Beaker() {
  return (
    <mesh castShadow>
      <latheGeometry args={[BEAKER_WALL, 64]} />
      <GlassMaterial color={BENCH_COLORS.glass} />
    </mesh>
  );
}
