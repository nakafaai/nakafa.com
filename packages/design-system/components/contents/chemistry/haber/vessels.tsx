import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import {
  CONDENSER_X,
  CONVERTER_X,
  RIG_Z,
} from "@repo/design-system/components/contents/chemistry/haber/geometry";
import { head } from "@repo/design-system/components/three/form/outline";
import { Sweep, Turn } from "@repo/design-system/components/three/form/part";
import type { Path } from "@repo/design-system/components/three/form/path";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { DoubleSide } from "three";

/** How far the converter's bolting flanges stand out, and how deep they are. */
const FLANGE = [0.012, 0.014] as const;

/** The condenser's cooling coil: five and a half turns down the jacket, with a lead through the wall at each end. */
const COIL: Path = {
  from: [0, 0.328, 0],
  kind: "helix",
  lead: [[0.086, 0.328, 0]],
  radius: 0.05,
  tail: [[0.086, 0.19, 0]],
  to: [0, 0.19, 0],
  turns: -5.5,
};

/** Bolted stainless pressure converter tower with cutaway window and 3 glowing iron catalyst beds. */
export function ConverterVessel({
  temperatureC,
}: {
  readonly temperatureC: number;
}) {
  const tempNorm = Math.max(0, Math.min(1, (temperatureC - 300) / 300));
  const glowIntensity = 0.08 + tempNorm * 1.55;
  const bedHeights = [0.155, 0.22, 0.285] as const;
  const legs = Arr.makeBy(4, (step) => (step / 4) * Math.PI * 2 + Math.PI / 4);
  const bolts = Arr.makeBy(12, (step) => (step / 12) * Math.PI * 2);
  const pellets = Arr.makeBy(10, (step) => ({
    angle: step * 2.1,
    r: 0.016 + (step % 3) * 0.018,
  }));

  return (
    <group position={[CONVERTER_X, 0.014, RIG_Z]}>
      {Arr.map(legs, (ang) => (
        <mesh
          castShadow
          key={ang}
          position={[Math.cos(ang) * 0.072, 0.044, Math.sin(ang) * 0.072]}
        >
          <cylinderGeometry args={[0.008, 0.01, 0.088, 14]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.105, 0]} rotation={[Math.PI, 0, 0]}>
        <Turn profile={head(0.09, 0.044, FLANGE)} />
        <MetalMaterial color={PROCESS_COLORS.alloySteel} roughness={0.32} />
      </mesh>
      <mesh castShadow position={[0, 0.335, 0]}>
        <Turn profile={head(0.09, 0.056, FLANGE)} />
        <MetalMaterial color={PROCESS_COLORS.alloySteel} roughness={0.32} />
      </mesh>
      {Arr.map([0.102, 0.338] as const, (y) => (
        <group key={y} position={[0, y, 0]}>
          {Arr.map(bolts, (ang) => (
            <mesh
              key={ang}
              position={[Math.cos(ang) * 0.097, 0.008, Math.sin(ang) * 0.097]}
            >
              <cylinderGeometry args={[0.0038, 0.0038, 0.01, 6]} />
              <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh castShadow position={[0, 0.22, 0]}>
        <cylinderGeometry
          args={[0.09, 0.09, 0.232, 40, 1, true, 0.56, Math.PI * 2 - 1.12]}
        />
        <MetalMaterial color={PROCESS_COLORS.ironDark} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry
          args={[0.082, 0.082, 0.23, 36, 1, true, 0.56, Math.PI * 2 - 1.12]}
        />
        <meshStandardMaterial
          color={CAR_COLORS.castIron}
          emissive={PROCESS_COLORS.hotRed}
          emissiveIntensity={tempNorm * 0.35}
          roughness={0.75}
          side={DoubleSide}
        />
      </mesh>
      {Arr.map(bedHeights, (y) => (
        <group key={y} position={[0, y, 0]}>
          <mesh>
            <cylinderGeometry args={[0.076, 0.076, 0.01, 28]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.38} />
          </mesh>
          <mesh position={[0, 0.013, 0]}>
            <cylinderGeometry args={[0.073, 0.073, 0.018, 28]} />
            <meshStandardMaterial
              color={PROCESS_COLORS.vanadiumOrange}
              emissive={PROCESS_COLORS.hotRed}
              emissiveIntensity={glowIntensity}
              metalness={0.45}
              roughness={0.55}
            />
          </mesh>
          {Arr.map(pellets, (p) => (
            <mesh
              key={`${p.angle}-${p.r}`}
              position={[
                Math.cos(p.angle) * p.r,
                0.025,
                Math.sin(p.angle) * p.r,
              ]}
            >
              <sphereGeometry args={[0.0068, 8, 8]} />
              <meshStandardMaterial
                color={PROCESS_COLORS.vanadiumOrange}
                emissive={PROCESS_COLORS.hotRed}
                emissiveIntensity={glowIntensity * 1.1}
                roughness={0.5}
              />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry
          args={[0.089, 0.089, 0.224, 24, 1, true, -0.54, 1.08]}
        />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.22} />
      </mesh>
      <pointLight
        color={PROCESS_COLORS.hotRed}
        distance={0.38}
        intensity={0.04 + tempNorm * 0.45}
        position={[0, 0.22, 0.05]}
      />
    </group>
  );
}

/** Borosilicate jacketed cooling condenser with helical coil and liquid NH3 sump. */
export function CondenserUnit({
  yieldPercent,
}: {
  readonly yieldPercent: number;
}) {
  const liquidLevel = 0.072 + (yieldPercent / 72) * 0.115;
  const tieRods = Arr.makeBy(
    4,
    (step) => (step / 4) * Math.PI * 2 + Math.PI / 4
  );

  return (
    <group position={[CONDENSER_X, 0.014, RIG_Z]}>
      {Arr.map(tieRods, (ang) => (
        <mesh
          castShadow
          key={`leg-${ang}`}
          position={[Math.cos(ang) * 0.064, 0.03, Math.sin(ang) * 0.064]}
        >
          <cylinderGeometry args={[0.006, 0.008, 0.06, 12]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.056, 0]}>
        <cylinderGeometry args={[0.082, 0.082, 0.018, 32]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.362, 0]}>
        <cylinderGeometry args={[0.082, 0.082, 0.018, 32]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
      </mesh>
      {Arr.map(tieRods, (ang) => (
        <mesh
          key={`rod-${ang}`}
          position={[Math.cos(ang) * 0.076, 0.21, Math.sin(ang) * 0.076]}
        >
          <cylinderGeometry args={[0.0028, 0.0028, 0.308, 10]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
        </mesh>
      ))}
      <mesh castShadow>
        <Sweep path={COIL} radius={0.0042} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
      </mesh>
      {Arr.map([0.19, 0.328] as const, (y) => (
        <mesh key={y} position={[0.088, y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.022, 14]} />
          <MetalMaterial color={PROCESS_COLORS.catalystTeal} roughness={0.35} />
        </mesh>
      ))}
      <ColumnLiquid
        bottom={0.066}
        color={PROCESS_COLORS.ammoniaCyan}
        level={liquidLevel}
        opacity={0.78}
        radius={0.068}
      />
      <mesh position={[0, 0.21, 0]}>
        <cylinderGeometry args={[0.074, 0.074, 0.296, 40, 1, true]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.24} />
      </mesh>
      <mesh position={[0, 0.032, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.034, 14]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
      </mesh>
      <mesh position={[0.018, 0.03, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.011, 0.0024, 8, 20]} />
        <MetalMaterial color={PROCESS_COLORS.electronGold} roughness={0.28} />
      </mesh>
    </group>
  );
}
