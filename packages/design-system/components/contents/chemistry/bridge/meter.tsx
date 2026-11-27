import {
  ANODE_X,
  BEAKER_Z,
  CATHODE_X,
  CLIP_Y,
} from "@repo/design-system/components/contents/chemistry/bridge/apparatus";
import { Sweep } from "@repo/design-system/components/three/form/part";
import type { Path } from "@repo/design-system/components/three/form/path";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

export const METER_Z = -0.105;
const TERMINAL_Y = 0.259;
const TERMINAL_X = 0.052;
const TERMINAL_Z = METER_Z;

const METER_FEET = [
  [-0.062, -0.042],
  [0.062, -0.042],
  [-0.062, 0.042],
  [0.062, 0.042],
] as const;

const DIAL_TICKS = Arr.makeBy(13, (step) => 1.15 - (step / 12) * 2.3);

function createMeterBodyGeometry() {
  const side = new Shape();
  side.moveTo(-0.06, 0);
  side.lineTo(0.06, 0);
  side.lineTo(0.06, 0.115);
  side.lineTo(0.025, 0.236);
  side.lineTo(-0.06, 0.236);
  side.closePath();
  const geo = new ExtrudeGeometry(side, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.004,
    bevelThickness: 0.004,
    depth: 0.152,
  });
  geo.translate(0, 0, -0.076);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

/** The black test lead from the anode clip up to the voltmeter's negative terminal. */
export const LEFT_LEAD: Path = [
  [ANODE_X, CLIP_Y + 0.012, BEAKER_Z],
  [ANODE_X - 0.016, 0.218, BEAKER_Z - 0.01],
  [-0.12, 0.268, -0.028],
  [-TERMINAL_X, TERMINAL_Y, TERMINAL_Z],
];

/** The red test lead from the voltmeter's positive terminal down to the cathode clip. */
export const RIGHT_LEAD: Path = [
  [TERMINAL_X, TERMINAL_Y, TERMINAL_Z],
  [0.12, 0.268, -0.028],
  [CATHODE_X + 0.016, 0.218, BEAKER_Z - 0.01],
  [CATHODE_X, CLIP_Y + 0.012, BEAKER_Z],
];

/** Sloped benchtop laboratory voltmeter with circular analog dial, brass bezel, ticks, and live needle. */
export function BenchVoltmeter({ emfVolts }: { readonly emfVolts: number }) {
  const bodyGeo = useMemo(createMeterBodyGeometry, []);
  useEffect(() => () => bodyGeo.dispose(), [bodyGeo]);

  const normEmf = Math.min(1, Math.max(0, emfVolts / 3));
  const needleAngle = 1.15 - normEmf * 2.3;

  return (
    <group position={[0, 0, METER_Z]}>
      {/* Rubber bench feet */}
      {Arr.map(METER_FEET, ([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.0035, z]}>
          <cylinderGeometry args={[0.009, 0.01, 0.007, 16]} />
          <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.85} />
        </mesh>
      ))}
      {/* Sloped dark instrument housing */}
      <mesh
        castShadow
        geometry={bodyGeo}
        position={[0, 0.007, 0]}
        receiveShadow
      >
        <meshPhysicalMaterial
          clearcoat={0.28}
          clearcoatRoughness={0.36}
          color={BENCH_COLORS.meterBody}
          metalness={0.18}
          roughness={0.44}
        />
      </mesh>
      {/* Circular analog dial assembly angled cleanly toward camera */}
      <group position={[0, 0.178, 0.049]} rotation={[-0.28, 0, 0]}>
        {/* Brass bezel housing */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.048, 0.05, 0.012, 36]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0, 0.0065]}>
          <torusGeometry args={[0.047, 0.0036, 12, 40]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.22} />
        </mesh>
        {/* Crisp white analog dial face */}
        <mesh position={[0, 0, 0.0066]}>
          <circleGeometry args={[0.044, 36]} />
          <meshStandardMaterial
            color={INSTRUMENT_COLORS.dialFace}
            roughness={0.42}
          />
        </mesh>
        {/* Colored voltage scale arc */}
        <mesh position={[0, -0.006, 0.0072]} rotation={[0, 0, 0.42]}>
          <ringGeometry args={[0.032, 0.0355, 24, 1, 0, 2.3]} />
          <meshBasicMaterial color={PROCESS_COLORS.catalystTeal} />
        </mesh>
        {/* Dial graduation ticks */}
        {Arr.map(DIAL_TICKS, (ang, idx) => (
          <mesh
            key={ang}
            position={[
              Math.sin(-ang) * 0.032,
              -0.006 + Math.cos(-ang) * 0.032,
              0.0076,
            ]}
            rotation={[0, 0, ang]}
          >
            <boxGeometry
              args={[
                idx % 4 === 0 ? 0.0022 : 0.0014,
                idx % 4 === 0 ? 0.0072 : 0.0046,
                0.0005,
              ]}
            />
            <meshBasicMaterial color={INSTRUMENT_COLORS.graphite} />
          </mesh>
        ))}
        {/* Live crimson analog needle deflecting with emfVolts */}
        <group position={[0, -0.006, 0.0086]} rotation={[0, 0, needleAngle]}>
          <mesh position={[0, 0.016, 0]}>
            <boxGeometry args={[0.0026, 0.034, 0.001]} />
            <meshStandardMaterial
              color={INSTRUMENT_COLORS.dialNeedle}
              emissive={INSTRUMENT_COLORS.dialNeedle}
              emissiveIntensity={0.22}
            />
          </mesh>
        </group>
        {/* Needle pivot cap */}
        <mesh position={[0, -0.006, 0.0098]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0048, 0.0048, 0.0035, 16]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.34} />
        </mesh>
        {/* Protective glass dial cover */}
        <mesh position={[0, 0, 0.0112]}>
          <circleGeometry args={[0.045, 36]} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.16} />
        </mesh>
      </group>
      {/* Twin brass binding terminals (- left black, + right red) */}
      {Arr.map(
        [
          [-TERMINAL_X, BENCH_COLORS.leadBlack],
          [TERMINAL_X, BENCH_COLORS.leadRed],
        ] as const,
        ([tx, collarColor]) => (
          <group key={tx} position={[tx, 0.247, 0]}>
            <mesh position={[0, 0.004, 0]}>
              <cylinderGeometry args={[0.0078, 0.0082, 0.008, 18]} />
              <meshStandardMaterial color={collarColor} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.012, 0]}>
              <cylinderGeometry args={[0.0052, 0.0052, 0.01, 16]} />
              <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
            </mesh>
          </group>
        )
      )}
    </group>
  );
}

/** Curved insulated black and red 4 mm test leads linking electrodes to the voltmeter. */
export function CurvedTestLeads() {
  return (
    <group>
      <mesh castShadow>
        <Sweep path={LEFT_LEAD} radius={0.0032} />
        <meshStandardMaterial color={BENCH_COLORS.leadBlack} roughness={0.52} />
      </mesh>
      <mesh castShadow>
        <Sweep path={RIGHT_LEAD} radius={0.0032} />
        <meshStandardMaterial color={BENCH_COLORS.leadRed} roughness={0.48} />
      </mesh>
    </group>
  );
}
