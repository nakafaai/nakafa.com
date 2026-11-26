import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  DoubleSide,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** Converts [radius, height] pairs into LatheGeometry Vector2 control points. */
function lathePoints(pairs: readonly (readonly [number, number])[]) {
  return Arr.map(pairs, ([radius, height]) => new Vector2(radius, height));
}

/** Thick-walled borosilicate glass pressure cylinder for the equilibrium reactor. */
function buildReactorCylinderGeometry() {
  const points = lathePoints([
    [0.068, 0],
    [0.074, 0],
    [0.074, 0.18],
    [0.068, 0.18],
    [0.068, 0],
  ]);
  return new LatheGeometry(points, 60);
}

/** Domed machined stainless steel top manifold cap. */
function buildManifoldCapGeometry() {
  const points = lathePoints([
    [0.0005, 0.022],
    [0.032, 0.021],
    [0.056, 0.014],
    [0.068, 0.004],
    [0.072, 0],
    [0.0005, 0],
  ]);
  return new LatheGeometry(points, 48);
}

/** Curved brass manifold pipe connecting the top flange to the side pressure gauge. */
function buildGaugeStemGeometry() {
  const curve = new CatmullRomCurve3([
    new Vector3(0.062, 0.221, 0.006),
    new Vector3(0.095, 0.221, 0.014),
    new Vector3(0.118, 0.205, 0.022),
    new Vector3(0.122, 0.182, 0.026),
  ]);
  return new TubeGeometry(curve, 24, 0.0036, 12, false);
}

/** Machined brass pressure gauge housing bezel. */
function buildGaugeBezelGeometry() {
  const points = lathePoints([
    [0.0005, 0],
    [0.024, 0],
    [0.027, 0.003],
    [0.027, 0.015],
    [0.025, 0.017],
    [0.022, 0.017],
    [0.022, 0.012],
    [0.0005, 0.012],
  ]);
  return new LatheGeometry(points, 36);
}

/** Sculpted machined metallic arrowhead cone profile. */
function buildRateArrowHeadGeometry() {
  const points = lathePoints([
    [0.0004, 0],
    [0.009, 0],
    [0.009, 0.003],
    [0.0004, 0.024],
  ]);
  return new LatheGeometry(points, 24);
}

const BOLT_ANGLES = Arr.makeBy(6, (index) => (index * Math.PI) / 3);
const TIE_ROD_ANGLES = [
  Math.PI * 0.25,
  Math.PI * 0.75,
  Math.PI * 1.25,
  Math.PI * 1.75,
] as const;

/** Sealed pressure-rated borosilicate reactor with bolted flanges, gaskets, valves, and LED. */
export function PressureReactor({
  balanced,
  gasHazeColor,
  gasHazeOpacity,
}: {
  readonly balanced: boolean;
  readonly gasHazeColor: string;
  readonly gasHazeOpacity: number;
}) {
  const glassGeo = useMemo(buildReactorCylinderGeometry, []);
  const capGeo = useMemo(buildManifoldCapGeometry, []);

  useEffect(
    () => () => {
      glassGeo.dispose();
      capGeo.dispose();
    },
    [capGeo, glassGeo]
  );

  return (
    <group>
      {/* 4 rubber leveling feet on benchtop */}
      {Arr.map(TIE_ROD_ANGLES, (angle) => (
        <mesh
          key={`foot-${angle}`}
          position={[Math.cos(angle) * 0.078, 0.003, Math.sin(angle) * 0.078]}
        >
          <cylinderGeometry args={[0.008, 0.01, 0.006, 14]} />
          <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.85} />
        </mesh>
      ))}
      {/* Cast steel base collar */}
      <mesh castShadow position={[0, 0.014, 0]} receiveShadow>
        <cylinderGeometry args={[0.09, 0.094, 0.016, 48]} />
        <MetalMaterial color={EQUILIBRIUM_COLORS.vesselBase} roughness={0.44} />
      </mesh>
      {/* Emerald equilibrium status LED on front face of base collar */}
      <group position={[0, 0.014, 0.092]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.0052, 0.0014, 10, 20]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.2} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.0044, 14, 12]} />
          <meshStandardMaterial
            color={
              balanced
                ? INSTRUMENT_COLORS.statusLed
                : EQUILIBRIUM_COLORS.qcMarker
            }
            emissive={
              balanced
                ? INSTRUMENT_COLORS.statusLed
                : EQUILIBRIUM_COLORS.qcMarker
            }
            emissiveIntensity={balanced ? 1.6 : 0.28}
            roughness={0.22}
          />
        </mesh>
      </group>
      {/* Bottom and top machined stainless bolted flanges */}
      {Arr.map([0.028, 0.221] as const, (flangeY) => (
        <group key={`flange-${flangeY}`} position={[0, flangeY, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.096, 0.096, 0.012, 56]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
          </mesh>
          {Arr.map(BOLT_ANGLES, (angle) => (
            <mesh
              key={`bolt-${flangeY}-${angle}`}
              position={[
                Math.cos(angle) * 0.085,
                0.0085,
                Math.sin(angle) * 0.085,
              ]}
            >
              <cylinderGeometry args={[0.0046, 0.0046, 0.006, 6]} />
              <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 4 vertical stainless steel tie-rods */}
      {Arr.map(TIE_ROD_ANGLES, (angle) => (
        <mesh
          castShadow
          key={`rod-${angle}`}
          position={[Math.cos(angle) * 0.085, 0.125, Math.sin(angle) * 0.085]}
        >
          <cylinderGeometry args={[0.0028, 0.0028, 0.194, 12]} />
          <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.25} />
        </mesh>
      ))}
      {/* Black Viton O-ring gaskets */}
      {Arr.map([0.0355, 0.2135] as const, (ringY) => (
        <mesh
          key={`oring-${ringY}`}
          position={[0, ringY, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.071, 0.0032, 12, 48]} />
          <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.82} />
        </mesh>
      ))}
      {/* Thick-walled borosilicate glass cylinder */}
      <mesh geometry={glassGeo} position={[0, 0.035, 0]}>
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.04}
          color={BENCH_COLORS.glass}
          depthWrite={false}
          ior={1.473}
          opacity={0.22}
          roughness={0.05}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {/* Internal gas vapour tint haze */}
      <mesh position={[0, 0.125, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.172, 36]} />
        <meshStandardMaterial
          color={gasHazeColor}
          depthWrite={false}
          opacity={gasHazeOpacity}
          roughness={0.9}
          transparent
        />
      </mesh>
      {/* Top manifold dome & twin brass needle valves */}
      <mesh castShadow geometry={capGeo} position={[0, 0.227, 0]}>
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.3} />
      </mesh>
      {Arr.map([-0.036, 0.036] as const, (vx) => (
        <group key={`valve-${vx}`} position={[vx, 0.238, 0]}>
          <mesh position={[0, 0.011, 0]}>
            <cylinderGeometry args={[0.0055, 0.0068, 0.022, 6]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
          </mesh>
          <mesh position={[0, 0.025, 0]}>
            <cylinderGeometry args={[0.0028, 0.0028, 0.012, 12]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.24} />
          </mesh>
          <mesh position={[0, 0.031, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.011, 0.0022, 10, 20]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.24} />
          </mesh>
          <mesh position={[0, 0.031, 0]}>
            <boxGeometry args={[0.021, 0.0024, 0.0024]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Side-mounted analog brass-bezel pressure gauge whose needle tracks concentration. */
export function AnalogPressureGauge({
  pressureRatio,
}: {
  readonly pressureRatio: number;
}) {
  const stemGeo = useMemo(buildGaugeStemGeometry, []);
  const bezelGeo = useMemo(buildGaugeBezelGeometry, []);

  useEffect(
    () => () => {
      stemGeo.dispose();
      bezelGeo.dispose();
    },
    [bezelGeo, stemGeo]
  );

  // Sweep needle from +126 deg (low pressure) to -126 deg (high pressure)
  const clamped = Math.max(0, Math.min(1, pressureRatio));
  const needleAngle = 2.2 - clamped * 4.4;
  const ticks = Arr.makeBy(9, (index) => 2.2 - (index / 8) * 4.4);

  return (
    <group>
      <mesh castShadow geometry={stemGeo}>
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
      </mesh>
      <group position={[0.122, 0.182, 0.034]} rotation={[-0.12, -0.22, 0]}>
        <mesh castShadow geometry={bezelGeo} rotation={[Math.PI / 2, 0, 0]}>
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.24} />
        </mesh>
        {/* Crisp white dial face */}
        <mesh position={[0, 0, 0.0125]}>
          <circleGeometry args={[0.022, 32]} />
          <meshStandardMaterial
            color={INSTRUMENT_COLORS.dialFace}
            roughness={0.55}
          />
        </mesh>
        {/* Scale tick marks */}
        {Arr.map(ticks, (angle) => (
          <mesh
            key={`gt-${angle}`}
            position={[Math.cos(angle) * 0.017, Math.sin(angle) * 0.017, 0.013]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[0.0038, 0.001, 0.0004]} />
            <meshBasicMaterial color={INSTRUMENT_COLORS.graphite} />
          </mesh>
        ))}
        {/* Pivoting red pressure needle */}
        <group position={[0, 0, 0.0138]} rotation={[0, 0, needleAngle]}>
          <mesh position={[0.0065, 0, 0]}>
            <boxGeometry args={[0.015, 0.0016, 0.0008]} />
            <meshStandardMaterial
              color={INSTRUMENT_COLORS.dialNeedle}
              roughness={0.35}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0026, 0.0026, 0.0018, 12]} />
            <MetalMaterial color={CAR_COLORS.dashboard} roughness={0.3} />
          </mesh>
        </group>
        {/* Glass dial cover */}
        <mesh position={[0, 0, 0.016]}>
          <circleGeometry args={[0.0225, 32]} />
          <meshPhysicalMaterial
            clearcoat={1}
            color={BENCH_COLORS.glass}
            depthWrite={false}
            opacity={0.22}
            roughness={0.04}
            transparent
          />
        </mesh>
      </group>
    </group>
  );
}

/** Machined anodized metallic bidirectional reaction-rate arrows above the manifold. */
export function MachinedRateArrows({
  forwardScale,
  reverseScale,
}: {
  readonly forwardScale: number;
  readonly reverseScale: number;
}) {
  const headGeo = useMemo(buildRateArrowHeadGeometry, []);
  useEffect(() => () => headGeo.dispose(), [headGeo]);

  const fwdLen = 0.085 * forwardScale;
  const revLen = 0.085 * reverseScale;

  return (
    <group position={[0, 0.296, 0.01]}>
      {/* Forward rate arrow pointing right (+X) */}
      <group position={[0, 0.013, 0]}>
        <mesh castShadow rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.0042, 0.0042, fwdLen, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={EQUILIBRIUM_COLORS.forwardArrow}
            metalness={0.45}
            roughness={0.28}
          />
        </mesh>
        <mesh
          castShadow
          geometry={headGeo}
          position={[fwdLen / 2, 0, 0]}
          rotation={[0, 0, -Math.PI / 2]}
        >
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={EQUILIBRIUM_COLORS.forwardArrow}
            metalness={0.45}
            roughness={0.28}
          />
        </mesh>
      </group>
      {/* Reverse rate arrow pointing left (-X) */}
      <group position={[0, -0.013, 0]}>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0042, 0.0042, revLen, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={EQUILIBRIUM_COLORS.reverseArrow}
            metalness={0.45}
            roughness={0.28}
          />
        </mesh>
        <mesh
          castShadow
          geometry={headGeo}
          position={[-revLen / 2, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={EQUILIBRIUM_COLORS.reverseArrow}
            metalness={0.45}
            roughness={0.28}
          />
        </mesh>
      </group>
    </group>
  );
}
