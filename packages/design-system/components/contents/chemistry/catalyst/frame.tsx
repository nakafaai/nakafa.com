import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { KINETICS_COLORS } from "@repo/design-system/lib/material/kinetics";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

/** Benchtop Z plane for the kinetic energy demonstration apparatus. */
export const RIG_Z = 0.05;

/** Z offset separating the back uncatalysed rail and front catalysed rail. */
export const RAIL_Z_OFFSET = 0.034;

/** Maps a model height onto the 0.43 m tall desktop energy apparatus. */
export function energyY(modelHeight: number): number {
  return 0.046 + modelHeight * 0.275;
}

/** Smooth reaction-coordinate arch from reactant to product across activation peak. */
export function archY(
  t: number,
  startY: number,
  peakY: number,
  endY: number
): number {
  const base = startY * (1 - t) + endY * t;
  const bump = Math.sin(Math.PI * t) ** 2 * (peakY - (startY + endY) / 2);
  return base + bump;
}

/** X coordinate along the horizontal reaction-coordinate track for progress `t` in [0, 1]. */
export function trackX(t: number): number {
  return -0.21 + t * 0.42;
}

const BASE_FEET = [
  [-0.295, -0.095],
  [0.295, -0.095],
  [-0.295, 0.095],
  [0.295, 0.095],
] as const;

const AXIS_TICKS = Arr.range(0, 6);
const SCALE_TICKS = Arr.range(0, 10);

/** Chamfered dark anodised aluminium instrument baseplate. */
function buildBaseplateGeometry(): ExtrudeGeometry {
  const w = 0.335;
  const d = 0.12;
  const r = 0.012;
  const shape = new Shape();
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r);
  shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r);
  shape.quadraticCurveTo(-w, -d, -w + r, -d);

  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.004,
    bevelThickness: 0.004,
    depth: 0.014,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * Dark anodised aluminium instrument baseplate with engraved brass scale ticks,
 * brushed-steel vertical energy axis stanchion, and horizontal baseline rail.
 */
export function EnergyAxisFrame() {
  const baseGeo = useMemo(buildBaseplateGeometry, []);

  useEffect(() => () => baseGeo.dispose(), [baseGeo]);

  return (
    <group position={[0, 0, RIG_Z]}>
      {Arr.map(BASE_FEET, ([fx, fz]) => (
        <mesh castShadow key={`${fx}-${fz}`} position={[fx, 0.003, fz]}>
          <cylinderGeometry args={[0.011, 0.013, 0.006, 16]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.34} />
        </mesh>
      ))}
      <mesh castShadow geometry={baseGeo} position={[0, 0.01, 0]} receiveShadow>
        <MetalMaterial color={CAR_COLORS.dashboard} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.029, 0.106]}>
        <boxGeometry args={[0.56, 0.002, 0.016]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.32} />
      </mesh>
      {Arr.map(SCALE_TICKS, (index) => (
        <mesh key={index} position={[-0.25 + index * 0.05, 0.0305, 0.106]}>
          <boxGeometry
            args={[0.002, 0.0015, index % 2 === 0 ? 0.012 : 0.007]}
          />
          <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.6} />
        </mesh>
      ))}
      <mesh castShadow position={[-0.3, 0.232, 0]}>
        <cylinderGeometry args={[0.0055, 0.0065, 0.408, 18]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
      </mesh>
      <mesh position={[-0.3, 0.442, 0]}>
        <coneGeometry args={[0.011, 0.022, 18]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
      </mesh>
      {Arr.map(AXIS_TICKS, (index) => (
        <mesh key={index} position={[-0.292, 0.075 + index * 0.055, 0]}>
          <boxGeometry args={[0.016, 0.0024, 0.0024]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.048, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0042, 0.0042, 0.6, 14]} />
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.28} />
      </mesh>
      <mesh position={[0.305, 0.048, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.009, 0.02, 16]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
      </mesh>
      {Arr.map([-0.26, 0.26] as const, (px) => (
        <mesh key={px} position={[px, 0.037, 0]}>
          <cylinderGeometry args={[0.007, 0.009, 0.022, 14]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.42} />
        </mesh>
      ))}
    </group>
  );
}

/** Glowing vertical indigo enthalpy gauge bar showing Delta H between terraces. */
export function EnthalpyGauge({
  isExothermic,
  productY,
  reactantY,
}: {
  readonly isExothermic: boolean;
  readonly productY: number;
  readonly reactantY: number;
}) {
  const lowY = Math.min(reactantY, productY);
  const highY = Math.max(reactantY, productY);
  const span = Math.max(0.01, highY - lowY);
  const midY = (lowY + highY) / 2;

  return (
    <group position={[0, 0, RIG_Z]}>
      <mesh position={[0.292, midY, 0]}>
        <cylinderGeometry args={[0.0045, 0.0045, span, 14]} />
        <meshStandardMaterial
          color={KINETICS_COLORS.enthalpyBar}
          emissive={KINETICS_COLORS.enthalpyBar}
          emissiveIntensity={0.65}
          roughness={0.25}
        />
      </mesh>
      <mesh
        position={[0.292, isExothermic ? lowY + 0.008 : highY - 0.008, 0]}
        rotation={[0, 0, isExothermic ? Math.PI : 0]}
      >
        <coneGeometry args={[0.01, 0.02, 16]} />
        <meshStandardMaterial
          color={KINETICS_COLORS.enthalpyBar}
          emissive={KINETICS_COLORS.enthalpyBar}
          emissiveIntensity={0.75}
          roughness={0.22}
        />
      </mesh>
      <mesh position={[0.275, reactantY, 0]}>
        <boxGeometry args={[0.036, 0.0024, 0.0024]} />
        <meshStandardMaterial
          color={KINETICS_COLORS.enthalpyBar}
          emissive={KINETICS_COLORS.enthalpyBar}
          emissiveIntensity={0.45}
        />
      </mesh>
      <mesh position={[0.275, productY, 0]}>
        <boxGeometry args={[0.036, 0.0024, 0.0024]} />
        <meshStandardMaterial
          color={KINETICS_COLORS.enthalpyBar}
          emissive={KINETICS_COLORS.enthalpyBar}
          emissiveIntensity={0.45}
        />
      </mesh>
    </group>
  );
}

/** Brushed-steel reactant and product terraces holding 3D ball-and-stick molecules. */
export function MolecularTerraces({
  productY,
  reactantY,
}: {
  readonly productY: number;
  readonly reactantY: number;
}) {
  const reactantStem = Math.max(0.02, reactantY - 0.028);
  const productStem = Math.max(0.02, productY - 0.028);

  return (
    <group position={[0, 0, RIG_Z]}>
      <group position={[-0.23, 0, 0]}>
        <mesh castShadow position={[0, 0.028 + reactantStem / 2, 0]}>
          <cylinderGeometry args={[0.008, 0.011, reactantStem, 16]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.24} />
        </mesh>
        <mesh castShadow position={[0, reactantY - 0.005, 0]} receiveShadow>
          <boxGeometry args={[0.072, 0.01, 0.112]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
        </mesh>
        <mesh position={[0, reactantY - 0.005, 0.057]}>
          <boxGeometry args={[0.072, 0.005, 0.003]} />
          <meshStandardMaterial
            color={KINETICS_COLORS.reactant}
            emissive={KINETICS_COLORS.reactant}
            emissiveIntensity={0.7}
          />
        </mesh>
        <group position={[0, reactantY + 0.017, 0]}>
          <mesh castShadow position={[-0.014, 0, -0.01]}>
            <sphereGeometry args={[0.011, 16, 14]} />
            <meshPhysicalMaterial
              clearcoat={0.8}
              color={KINETICS_COLORS.reactant}
              roughness={0.22}
            />
          </mesh>
          <mesh castShadow position={[0.012, 0.006, 0.008]}>
            <sphereGeometry args={[0.009, 16, 14]} />
            <meshPhysicalMaterial
              clearcoat={0.8}
              color={INSTRUMENT_COLORS.silver}
              roughness={0.22}
            />
          </mesh>
          <mesh position={[-0.001, 0.003, -0.001]} rotation={[0.45, -0.6, 1.3]}>
            <cylinderGeometry args={[0.0028, 0.0028, 0.032, 10]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
          </mesh>
          <mesh castShadow position={[0.016, -0.002, -0.022]}>
            <sphereGeometry args={[0.0085, 14, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.8}
              color={KINETICS_COLORS.activationLine}
              roughness={0.24}
            />
          </mesh>
        </group>
      </group>

      <group position={[0.23, 0, 0]}>
        <mesh castShadow position={[0, 0.028 + productStem / 2, 0]}>
          <cylinderGeometry args={[0.008, 0.011, productStem, 16]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.24} />
        </mesh>
        <mesh castShadow position={[0, productY - 0.005, 0]} receiveShadow>
          <boxGeometry args={[0.072, 0.01, 0.112]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
        </mesh>
        <mesh position={[0, productY - 0.005, 0.057]}>
          <boxGeometry args={[0.072, 0.005, 0.003]} />
          <meshStandardMaterial
            color={KINETICS_COLORS.product}
            emissive={KINETICS_COLORS.product}
            emissiveIntensity={0.7}
          />
        </mesh>
        <group position={[0, productY + 0.017, 0]}>
          <mesh castShadow position={[-0.012, 0.003, 0.008]}>
            <sphereGeometry args={[0.011, 16, 14]} />
            <meshPhysicalMaterial
              clearcoat={0.8}
              color={KINETICS_COLORS.product}
              roughness={0.22}
            />
          </mesh>
          <mesh castShadow position={[0.014, 0.002, -0.006]}>
            <sphereGeometry args={[0.01, 16, 14]} />
            <meshPhysicalMaterial
              clearcoat={0.8}
              color={KINETICS_COLORS.activationLine}
              roughness={0.22}
            />
          </mesh>
          <mesh
            position={[0.001, 0.0025, 0.001]}
            rotation={[0.2, 0.5, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.0028, 0.0028, 0.028, 10]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
          </mesh>
          <mesh castShadow position={[-0.004, 0.014, -0.014]}>
            <sphereGeometry args={[0.008, 14, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.8}
              color={INSTRUMENT_COLORS.silver}
              roughness={0.22}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
