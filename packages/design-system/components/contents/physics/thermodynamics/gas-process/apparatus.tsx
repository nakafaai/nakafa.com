import { Line } from "@react-three/drei";
import { CYLINDER } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/cylinder";
import type { GasProcess } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { GAS_COLORS } from "@repo/design-system/lib/material/gas";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import type { Ref, RefObject } from "react";
import { useImperativeHandle, useMemo, useRef } from "react";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { Shape } from "three";

/** The stand the cylinder stands on, in metres: a steel block with a plate on top that heats or cools the gas. */
const STAND = { height: 0.03, plate: 0.062, width: 0.15 } as const;

/** The floor of the gas, on the steel cap the glass stands in. */
export const FLOOR = STAND.height + 0.012;

/** Where the thermometer stands on the bench, beside the cylinder's front. */
const METER = [0.12, 0, 0.1] as const;

/** The water bath of an isothermal process: a glass tank round the cylinder's foot, and how high its water stands. */
const BATH = { height: 0.17, level: 0.15, width: 0.18 } as const;

/** The foam jacket of an adiabatic process: its thickness, and the gap it leaves open at the front to show the gas. */
const JACKET = { gap: 1.9, thickness: 0.02 } as const;

/**
 * The steel stand under the cylinder and the plate on its top, which
 * glows orange while it heats the gas and frosts blue while it cools it.
 * A scene sets the plate's glow through `plate`.
 */
export function Stand({
  plate,
}: {
  readonly plate: Ref<MeshStandardMaterial>;
}) {
  return (
    <group>
      <mesh
        castShadow
        position={[0, STAND.height / 2 - 0.002, 0]}
        receiveShadow
      >
        <boxGeometry args={[STAND.width, STAND.height - 0.004, STAND.width]} />
        <MetalMaterial color={INSTRUMENT_COLORS.aluminium} roughness={0.5} />
      </mesh>
      <mesh position={[0, STAND.height - 0.002, 0]} receiveShadow>
        <cylinderGeometry args={[STAND.plate, STAND.plate, 0.004, 48]} />
        <meshStandardMaterial
          color={GAS_COLORS.plate}
          emissive={GAS_COLORS.plateHot}
          emissiveIntensity={0}
          metalness={0.6}
          ref={plate}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

/** A glass tank of water round the cylinder's foot, which keeps the gas at the water's temperature. */
function WaterBath() {
  return (
    <group>
      <mesh position={[0, BATH.height / 2, 0]}>
        <boxGeometry args={[BATH.width, BATH.height, BATH.width]} />
        <GlassMaterial color={INSTRUMENT_COLORS.platinum} opacity={0.18} />
      </mesh>
      <mesh position={[0, BATH.level / 2 + 0.002, 0]}>
        <boxGeometry
          args={[BATH.width - 0.006, BATH.level - 0.004, BATH.width - 0.006]}
        />
        <LiquidMaterial color={GAS_COLORS.water} opacity={0.3} />
      </mesh>
    </group>
  );
}

/** A thick sleeve of insulating foam round the glass, cut away at the front so the gas shows, which keeps heat from passing. */
function FoamJacket() {
  const shape = useMemo(() => {
    const inner = CYLINDER.radius + 0.006;
    const outer = inner + JACKET.thickness;
    const from = Math.PI / 2 + JACKET.gap / 2;
    const to = from + 2 * Math.PI - JACKET.gap;
    const sleeve = new Shape();
    sleeve.absarc(0, 0, outer, from, to, false);
    sleeve.absarc(0, 0, inner, to, from, true);
    return sleeve;
  }, []);

  return (
    <mesh
      castShadow
      position={[0, STAND.height, 0]}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <extrudeGeometry
        args={[
          shape,
          { bevelEnabled: false, curveSegments: 40, depth: -CYLINDER.height },
        ]}
      />
      <meshStandardMaterial color={GAS_COLORS.foam} roughness={0.95} />
    </mesh>
  );
}

/**
 * What holds one quantity of the gas fixed, round the cylinder: the water
 * bath that holds an isothermal gas's temperature, or the foam jacket that
 * keeps heat from an adiabatic gas. The weight that holds an isobaric gas's
 * pressure and the pins that hold an isochoric gas's volume ride with the
 * piston.
 */
export function Keeper({ process }: { readonly process: GasProcess }) {
  if (process === "isothermal") {
    return <WaterBath />;
  }
  return process === "adiabatic" ? <FoamJacket /> : null;
}

/** An energy arrow's shaft and head, in metres. */
const ARROW = { head: 0.022, headRadius: 0.011, radius: 0.0045 } as const;

/**
 * A solid arrow along its group's y axis, in the colour of the energy it
 * stands for, with the energy's name beside it, `side` metres across. A
 * scene spans it each frame through `handle`, from `from` to `to` along the
 * axis, so it grows with the energy and points the way it flows.
 */
export function EnergyArrow({
  color,
  handle,
  name,
  side,
}: {
  readonly color: string;
  readonly handle: Ref<{
    readonly span: (from: number, to: number) => void;
  }>;
  readonly name: string;
  readonly side: number;
}) {
  const body = useRef<Group>(null);
  const shaft = useRef<Mesh>(null);
  const head = useRef<Mesh>(null);
  const label = useRef<Group>(null);

  useImperativeHandle(
    handle,
    () => ({
      span: (from, to) => {
        const length = Math.abs(to - from);
        const way = to >= from ? 1 : -1;
        const tip = Math.min(ARROW.head, length * 0.6);
        const stem = Math.max(length - tip, 1e-4);
        body.current?.scale.setScalar(length > 1e-4 ? 1 : 0);
        shaft.current?.position.set(0, from + (way * stem) / 2, 0);
        shaft.current?.scale.set(1, stem, 1);
        head.current?.position.set(0, to - (way * tip) / 2, 0);
        head.current?.scale.set(1, tip, 1);
        head.current?.rotation.set(0, 0, way > 0 ? 0 : Math.PI);
        label.current?.position.set(side, (from + to) / 2, 0);
      },
    }),
    [side]
  );

  return (
    <group>
      <group ref={body}>
        <mesh castShadow ref={shaft} renderOrder={2}>
          <cylinderGeometry args={[ARROW.radius, ARROW.radius, 1, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.45}
            envMapIntensity={0.3}
            roughness={0.45}
            transparent
          />
        </mesh>
        <mesh castShadow ref={head} renderOrder={2}>
          <coneGeometry args={[ARROW.headRadius, 1, 20]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.45}
            envMapIntensity={0.3}
            roughness={0.45}
            transparent
          />
        </mesh>
      </group>
      <group ref={label}>
        <ThreeLabel
          color={color}
          fontSize={0.02}
          minimumFontSize={13}
          position={[0, 0, 0]}
        >
          <InlineMath math={name} />
        </ThreeLabel>
      </group>
    </group>
  );
}

/**
 * A digital thermometer on the bench in front of the cylinder, its probe
 * wired into the gas through the cap. A scene writes its reading into
 * `reading` each frame.
 */
export function Thermometer({
  reading,
}: {
  readonly reading: RefObject<HTMLSpanElement | null>;
}) {
  return (
    <group>
      <group position={METER} rotation={[-0.3, -0.35, 0]}>
        <mesh castShadow position={[0, 0.034, 0]}>
          <boxGeometry args={[0.13, 0.068, 0.028]} />
          <meshStandardMaterial color={GAS_COLORS.meterCase} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.036, 0.0141]}>
          <planeGeometry args={[0.116, 0.046]} />
          <meshStandardMaterial
            color={BENCH_COLORS.lcd}
            emissive={BENCH_COLORS.lcdGlow}
            roughness={0.3}
          />
        </mesh>
        <ThreeLabel
          color={BENCH_COLORS.lcdInk}
          fontSize={0.016}
          minimumFontSize={11}
          outlineColor={BENCH_COLORS.lcd}
          outlineWidth={0.001}
          position={[0, 0.036, 0.015]}
        >
          <span ref={reading} />
        </ThreeLabel>
      </group>
      <Line
        color={BENCH_COLORS.leadBlack}
        lineWidth={2}
        points={[
          [METER[0] - 0.04, 0.012, METER[2] - 0.012],
          [0.03, 0.006, 0.05],
          [0, FLOOR - 0.008, CYLINDER.radius + 0.008],
        ]}
      />
    </group>
  );
}
