import {
  createBeakerMarkingsTexture,
  createEpoxyTexture,
  createFlaskMarkingsTexture,
  liquidMeniscus,
  ReagentShelf,
} from "@repo/design-system/components/contents/chemistry/glassware";
import { Turn } from "@repo/design-system/components/three/form/part";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { Array as Arr } from "effect";
import type { ReactNode, Ref } from "react";
import { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { ExtrudeGeometry, Shape } from "three";

/** How thick the wall of laboratory borosilicate glassware is, about 1.8 mm. */
export const GLASS_WALL = 0.0018;

/**
 * A school chemistry bench at real size, in metres: a speckled dark phenolic
 * epoxy worktop 0.9 m deep with beveled edge and stainless backsplash rail on
 * a pale laboratory cabinet, backed by a row of translucent borosilicate
 * reagent bottles with visible liquid menisci and printed formula labels.
 * Experiments stand on the worktop at y = 0.
 */
export function LabBench({ width = 2.4 }: { readonly width?: number }) {
  const epoxyTex = useMemo(createEpoxyTexture, []);
  useEffect(() => () => epoxyTex?.dispose(), [epoxyTex]);

  return (
    <group>
      <mesh position={[0, -0.025, 0]} receiveShadow>
        <boxGeometry args={[width, 0.05, 0.9]} />
        <meshPhysicalMaterial
          clearcoat={0.28}
          clearcoatRoughness={0.42}
          color={epoxyTex === null ? BENCH_COLORS.epoxy : getColor("WHITE")}
          map={epoxyTex}
          roughness={0.58}
        />
      </mesh>
      <mesh position={[0, -0.048, 0.448]}>
        <boxGeometry args={[width, 0.008, 0.012]} />
        <meshStandardMaterial color={BENCH_COLORS.epoxyDrip} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.026, -0.442]} receiveShadow>
        <boxGeometry args={[width, 0.052, 0.016]} />
        <MetalMaterial color={BENCH_COLORS.backsplashSteel} roughness={0.34} />
      </mesh>
      <mesh position={[0, -0.47, 0.02]}>
        <boxGeometry args={[width - 0.04, 0.84, 0.86]} />
        <meshStandardMaterial color={BENCH_COLORS.cabinet} roughness={0.62} />
      </mesh>
      <mesh position={[0, -0.22, 0.452]}>
        <boxGeometry args={[width - 0.1, 0.005, 0.004]} />
        <meshStandardMaterial
          color={BENCH_COLORS.cabinetSeam}
          roughness={0.8}
        />
      </mesh>
      <mesh position={[0, -0.14, 0.458]}>
        <boxGeometry args={[0.16, 0.012, 0.012]} />
        <MetalMaterial color={BENCH_COLORS.cabinetHandle} roughness={0.32} />
      </mesh>
      <ReagentShelf width={width} />
    </group>
  );
}

/** What a simulation writes on the balance's display every frame. */
export interface ScaleRig {
  /** Shows `text` on the display, such as "101,14 g". */
  readonly show: (text: string) => void;
}

const CONSOLE_KEYS = [
  { color: BENCH_COLORS.balanceKeyTare, id: "tare", x: 0.044 },
  { color: BENCH_COLORS.balanceKey, id: "zero", x: 0.066 },
  { color: BENCH_COLORS.balanceKey, id: "unit", x: 0.088 },
] as const;

const BALANCE = {
  feet: [
    [0.12, 0.14],
    [-0.12, 0.14],
    [0.12, -0.14],
    [-0.12, -0.14],
  ],
  pan: -0.035,
  panel: [0, 0.072, 0.122],
  slope: 0.43,
} as const;

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
    bevelSegments: 4,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    depth: 0.288,
  });
  geometry.translate(0, 0, -0.144);
  return geometry;
}

/**
 * A laboratory top-pan analytical balance with brushed stainless weighing pan,
 * recessed well, spirit-level bubble vial, tactile membrane keys, and backlit
 * LCD display that updates via `ref` without re-rendering React.
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
        <mesh key={`${x}-${z}`} position={[x, 0.004, z]}>
          <cylinderGeometry args={[0.014, 0.016, 0.008, 20]} />
          <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 0.012, 0]} receiveShadow>
        <boxGeometry args={[0.286, 0.014, 0.332]} />
        <meshStandardMaterial
          color={BENCH_COLORS.balanceSkirt}
          roughness={0.62}
        />
      </mesh>
      <mesh
        castShadow
        geometry={body}
        position={[0, 0.014, 0]}
        receiveShadow
        rotation={[0, -Math.PI / 2, 0]}
      >
        <meshPhysicalMaterial
          clearcoat={0.22}
          clearcoatRoughness={0.38}
          color={BENCH_COLORS.balanceBody}
          metalness={0.08}
          roughness={0.44}
        />
      </mesh>
      <mesh position={[0, 0.09, BALANCE.pan]}>
        <cylinderGeometry args={[0.106, 0.108, 0.006, 64]} />
        <meshStandardMaterial
          color={BENCH_COLORS.balanceWell}
          roughness={0.6}
        />
      </mesh>
      <mesh position={[0, 0.093, BALANCE.pan]}>
        <cylinderGeometry args={[0.024, 0.028, 0.008, 32]} />
        <MetalMaterial color={BENCH_COLORS.panPedestal} roughness={0.35} />
      </mesh>
      <group position={[-0.118, 0.09, 0.068]}>
        <mesh>
          <cylinderGeometry args={[0.009, 0.0095, 0.005, 24]} />
          <MetalMaterial color={BENCH_COLORS.levelRing} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.0028, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.0018, 20]} />
          <meshStandardMaterial
            color={BENCH_COLORS.levelFluid}
            emissive={BENCH_COLORS.levelGlow}
            emissiveIntensity={0.28}
            roughness={0.18}
          />
        </mesh>
        <mesh position={[0.0012, 0.0038, -0.0008]}>
          <sphereGeometry args={[0.002, 12, 10]} />
          <meshStandardMaterial
            color={BENCH_COLORS.levelBubble}
            roughness={0.12}
          />
        </mesh>
      </group>
      <group position={BALANCE.panel} rotation={[BALANCE.slope, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.205, 0.006, 0.05]} />
          <meshPhysicalMaterial
            clearcoat={0.2}
            color={BENCH_COLORS.balanceBezel}
            metalness={0.25}
            roughness={0.45}
          />
        </mesh>
        <mesh position={[-0.032, 0.0032, 0]}>
          <boxGeometry args={[0.116, 0.002, 0.034]} />
          <MetalMaterial color={BENCH_COLORS.balanceFrame} roughness={0.38} />
        </mesh>
        <mesh position={[-0.032, 0.0044, 0]}>
          <boxGeometry args={[0.108, 0.0014, 0.028]} />
          <meshStandardMaterial
            color={BENCH_COLORS.lcd}
            emissive={BENCH_COLORS.lcdGlow}
            emissiveIntensity={0.8}
            roughness={0.16}
          />
        </mesh>
        <mesh position={[-0.032, 0.0054, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.108, 0.028]} />
          <GlassMaterial color={BENCH_COLORS.lcdCover} opacity={0.14} />
        </mesh>
        {Arr.map(CONSOLE_KEYS, (key) => (
          <group key={key.id} position={[key.x, 0.0045, 0]}>
            <mesh>
              <boxGeometry args={[0.017, 0.003, 0.018]} />
              <meshStandardMaterial
                color={BENCH_COLORS.balanceKeyFrame}
                roughness={0.55}
              />
            </mesh>
            <mesh position={[0, 0.0018, 0]}>
              <boxGeometry args={[0.014, 0.0022, 0.015]} />
              <meshStandardMaterial color={key.color} roughness={0.42} />
            </mesh>
          </group>
        ))}
        <ThreeLabel
          color={BENCH_COLORS.lcdInk}
          fontSize="compact"
          minimumFontSize={15}
          outlineColor={BENCH_COLORS.lcdHalo}
          outlineWidth={0.003}
          position={[-0.032, 0.0072, 0]}
        >
          {reading ?? (
            <>
              <span
                className="font-mono font-semibold tabular-nums"
                ref={display}
              />{" "}
              <span className="font-mono font-semibold">{unitLabel}</span>
            </>
          )}
        </ThreeLabel>
      </group>
      <mesh castShadow position={[0, 0.095, BALANCE.pan]} receiveShadow>
        <cylinderGeometry args={[0.1, 0.097, 0.006, 64]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.0982, BALANCE.pan]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.099, 0.0022, 10, 64]} />
        <MetalMaterial color={BENCH_COLORS.panRim} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.0982, BALANCE.pan]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.088, 0.0007, 8, 64]} />
        <MetalMaterial color={BENCH_COLORS.panInnerGroove} roughness={0.35} />
      </mesh>
      <group position={[0, 0.098, BALANCE.pan]}>{children}</group>
    </group>
  );
}

/** A liquid standing in a straight glass, from `bottom` to `level` with meniscus. */
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
  const points = [
    [0, bottom],
    [radius, bottom],
    ...liquidMeniscus(radius, level),
    [0, level],
  ] as const;
  return (
    <mesh>
      <Turn profile={points} />
      <LiquidMaterial color={color} opacity={opacity} />
    </mesh>
  );
}

const FLASK_WALL = [
  [0, 0],
  [0.04, 0],
  [0.0435, 0.004],
  [0.0435, 0.013],
  [0.0182, 0.105],
  [0.0162, 0.112],
  [0.0162, 0.144],
  [0.019, 0.147],
  [0.0172, 0.1485],
  [0.0146, 0.145],
  [0.0146, 0.112],
  [0.0166, 0.104],
  [0.0414, 0.013],
  [0.039, 0.004],
  [0, 0.0035],
] as const;

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

/** A conical 250 mL Erlenmeyer flask of borosilicate 3.3 glass with graduations. */
export function Flask() {
  const markings = useMemo(createFlaskMarkingsTexture, []);
  useEffect(() => () => markings?.dispose(), [markings]);

  return (
    <group>
      <mesh castShadow renderOrder={2}>
        <Turn profile={FLASK_WALL} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.26} />
      </mesh>
      <mesh position={[0, 0.147, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.0176, 0.0015, 10, 48]} />
        <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.54} />
      </mesh>
      {markings === null ? null : (
        <mesh
          position={[0, 0.058, 0]}
          renderOrder={3}
          rotation={[0, -Math.PI, 0]}
        >
          <cylinderGeometry args={[0.02, 0.041, 0.088, 40, 1, true]} />
          <meshBasicMaterial
            depthWrite={false}
            map={markings}
            opacity={0.88}
            transparent
          />
        </mesh>
      )}
    </group>
  );
}

/** The liquid in a conical flask, filled to `level` metres with a curved meniscus. */
export function FlaskLiquid({
  color,
  level,
  opacity = 0.72,
}: {
  readonly color: string;
  readonly level: number;
  readonly opacity?: number;
}) {
  const points = [
    [0, 0.0038],
    ...Arr.map(Arr.range(0, 7), (step) => {
      const y = 0.0038 + ((level - 0.0038) * step) / 8;
      return [flaskRadiusAt(y) - 0.002, y] as const;
    }),
    ...liquidMeniscus(flaskRadiusAt(level) - 0.002, level),
    [0, level],
  ] as const;
  return (
    <mesh>
      <Turn profile={points} />
      <LiquidMaterial color={color} opacity={opacity} />
    </mesh>
  );
}

const BEAKER_WALL = [
  [0, 0],
  [0.0245, 0],
  [0.0268, 0.0035],
  [0.0268, 0.069],
  [0.0286, 0.072],
  [0.0272, 0.0732],
  [0.0249, 0.069],
  [0.0249, 0.0042],
  [0.023, 0.0032],
  [0, 0.0032],
] as const;

/** A 100 mL borosilicate Griffin beaker with double-walled rim, pouring lip, and graduations. */
export function Beaker() {
  const markings = useMemo(createBeakerMarkingsTexture, []);
  useEffect(() => () => markings?.dispose(), [markings]);

  return (
    <group>
      <mesh castShadow renderOrder={2}>
        <Turn profile={BEAKER_WALL} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.28} />
      </mesh>
      <mesh position={[0, 0.0722, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.0277, 0.0012, 10, 56]} />
        <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.56} />
      </mesh>
      <mesh
        position={[0.0282, 0.0715, 0]}
        rotation={[0, 0, -0.35]}
        scale={[1.1, 0.65, 0.7]}
      >
        <cylinderGeometry
          args={[0.003, 0.0042, 0.007, 14, 1, true, -1.2, 2.4]}
        />
        <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.62} />
      </mesh>
      {markings === null ? null : (
        <mesh
          position={[0, 0.036, 0]}
          renderOrder={3}
          rotation={[0, -Math.PI, 0]}
        >
          <cylinderGeometry args={[0.0271, 0.0271, 0.058, 44, 1, true]} />
          <meshBasicMaterial
            depthWrite={false}
            map={markings}
            opacity={0.92}
            transparent
          />
        </mesh>
      )}
    </group>
  );
}
