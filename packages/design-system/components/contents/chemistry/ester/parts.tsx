import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import {
  AXIS_X,
  AXIS_Z,
  CONDENSER_JACKET,
  CONDENSER_TUBE,
  createHotplateBody,
  esterTint,
  FLASK,
  INLET_HOSE,
  layerOf,
  OUTLET_HOSE,
  ROD_X,
  ROD_Z,
  WATER_BATH,
} from "@repo/design-system/components/contents/chemistry/ester/geometry";
import type { EsterId } from "@repo/design-system/components/contents/chemistry/ester/model";
import { Sweep, Turn } from "@repo/design-system/components/three/form/part";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";

const HOTPLATE_FEET = [
  [-0.064, 0.068],
  [0.064, 0.068],
  [-0.064, -0.068],
  [0.064, -0.068],
] as const;

/** Cast-iron retort stand with chrome rod and dual bosshead clamps. */
export function RetortStand() {
  const reach = Math.hypot(AXIS_X - ROD_X, AXIS_Z - ROD_Z);
  const yaw = Math.atan2(AXIS_Z - ROD_Z, AXIS_X - ROD_X);
  const clamps = [
    { id: "lower", radius: 0.0175, y: 0.206 },
    { id: "upper", radius: 0.0225, y: 0.352 },
  ] as const;

  return (
    <group>
      {/* Cast-iron rectangular stand base resting clear to the left of the hotplate */}
      <mesh castShadow position={[-0.135, 0.006, 0.005]} receiveShadow>
        <boxGeometry args={[0.11, 0.012, 0.21]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.62} />
      </mesh>
      {/* Vertical chrome retort rod */}
      <mesh castShadow position={[ROD_X, 0.248, ROD_Z]}>
        <cylinderGeometry args={[0.0055, 0.0055, 0.476, 18]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
      </mesh>
      {Arr.map(clamps, (clamp) => (
        <group key={clamp.id}>
          {/* Bosshead block and thumbscrew on rod */}
          <mesh castShadow position={[ROD_X, clamp.y, ROD_Z]}>
            <boxGeometry args={[0.022, 0.022, 0.02]} />
            <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
          </mesh>
          <mesh
            position={[ROD_X - 0.016, clamp.y, ROD_Z]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.004, 0.004, 0.014, 12]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.28} />
          </mesh>
          {/* Horizontal chrome clamp stem */}
          <mesh
            castShadow
            position={[(ROD_X + AXIS_X) / 2, clamp.y, (ROD_Z + AXIS_Z) / 2]}
            rotation={[0, -yaw, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.0036, 0.0036, reach, 12]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
          </mesh>
          {/* Rubber-sleeved jaws gripping glassware */}
          <mesh
            position={[AXIS_X, clamp.y, AXIS_Z]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[clamp.radius, 0.0032, 10, 32]} />
            <meshStandardMaterial
              color={CAR_COLORS.dashboard}
              roughness={0.78}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Compact benchtop electric hotplate supporting the water bath. */
export function RefluxHotplate({
  heatNorm,
  playing,
}: {
  readonly heatNorm: number;
  readonly playing: boolean;
}) {
  const body = useMemo(createHotplateBody, []);
  useEffect(() => () => body.dispose(), [body]);

  const dialAngle = (-0.7 + heatNorm * 1.4) * Math.PI;

  return (
    <group position={[AXIS_X, 0, AXIS_Z + 0.015]}>
      {Arr.map(HOTPLATE_FEET, ([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.0025, z]}>
          <cylinderGeometry args={[0.0085, 0.01, 0.005, 16]} />
          <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.85} />
        </mesh>
      ))}
      <mesh
        castShadow
        geometry={body}
        position={[0, 0.006, 0]}
        receiveShadow
        rotation={[0, -Math.PI / 2, 0]}
      >
        <meshPhysicalMaterial
          clearcoat={0.25}
          clearcoatRoughness={0.35}
          color={BENCH_COLORS.hotplateBody}
          roughness={0.48}
        />
      </mesh>
      {/* Heating deck surround */}
      <mesh castShadow position={[0, 0.054, -0.015]} receiveShadow>
        <cylinderGeometry args={[0.062, 0.064, 0.005, 44]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.44} />
      </mesh>
      {/* Glowing ceramic plate */}
      <mesh position={[0, 0.0568, -0.015]}>
        <cylinderGeometry args={[0.057, 0.057, 0.0026, 44]} />
        <meshStandardMaterial
          color={BENCH_COLORS.ceramicTile}
          emissive={BENCH_COLORS.coalGlow}
          emissiveIntensity={0.04 + heatNorm * 1.4}
          roughness={0.36}
        />
      </mesh>
      {/* Heating coil glow ring */}
      <mesh position={[0, 0.0583, -0.015]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.038, 0.002, 10, 40]} />
        <meshStandardMaterial
          color={BENCH_COLORS.coals}
          emissive={BENCH_COLORS.coalGlow}
          emissiveIntensity={heatNorm * 2}
          roughness={0.4}
        />
      </mesh>
      {/* Sloped front temperature control panel */}
      <group position={[0, 0.038, 0.068]} rotation={[0.64, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.125, 0.0035, 0.036]} />
          <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.55} />
        </mesh>
        <group position={[0.028, 0.008, 0]} rotation={[0, -dialAngle, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.0095, 0.011, 0.012, 22]} />
            <meshStandardMaterial color={CAR_COLORS.hub} roughness={0.42} />
          </mesh>
          <mesh position={[0, 0.0064, -0.004]}>
            <boxGeometry args={[0.002, 0.0012, 0.007]} />
            <meshStandardMaterial
              color={BENCH_COLORS.coalGlow}
              emissive={BENCH_COLORS.coalGlow}
              emissiveIntensity={0.25 + heatNorm * 0.9}
              roughness={0.3}
            />
          </mesh>
        </group>
        <mesh position={[-0.032, 0.004, 0]}>
          <sphereGeometry args={[0.003, 12, 12]} />
          <meshStandardMaterial
            color={BENCH_COLORS.phosphorGlow}
            emissive={BENCH_COLORS.phosphorGlow}
            emissiveIntensity={playing ? 1.5 : 0.45}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Low-form borosilicate water bath dish resting on the hotplate. */
export function WaterBathDish() {
  return (
    <group position={[AXIS_X, 0.058, AXIS_Z]}>
      <ColumnLiquid
        bottom={0.0035}
        color={ORGANIC_COLORS.waterBlue}
        level={0.055}
        opacity={0.36}
        radius={0.0545}
      />
      <mesh castShadow renderOrder={3}>
        <Turn profile={WATER_BATH} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.26} />
      </mesh>
    </group>
  );
}

/**
 * Turned round-bottom borosilicate flask with B24 ground-glass neck joint
 * and stratified aqueous and floating ester liquid layers.
 */
export function RoundBottomFlask({
  ester,
  esterLayerRatio,
}: {
  readonly ester: EsterId;
  readonly esterLayerRatio: number;
}) {
  const esterThickness = 0.005 + esterLayerRatio * 0.017;
  const interfaceY = 0.128 - esterThickness * 0.25;
  const esterTopY = interfaceY + esterThickness;

  const organicColor = esterTint(ester);

  return (
    <group position={[AXIS_X, 0, AXIS_Z]}>
      {/* Lower aqueous alcohol and carboxylic acid layer */}
      <mesh renderOrder={1}>
        <Turn profile={layerOf(0.091, interfaceY)} />
        <LiquidMaterial color={ORGANIC_COLORS.waterBlue} opacity={0.46} />
      </mesh>
      {/* Upper floating fruity ester meniscus layer */}
      <mesh renderOrder={1}>
        <Turn profile={layerOf(interfaceY, esterTopY)} />
        <LiquidMaterial color={organicColor} opacity={0.86} />
      </mesh>
      {/* Frosted B24 ground-glass socket collar */}
      <mesh position={[0, 0.221, 0]} renderOrder={2}>
        <cylinderGeometry args={[0.0168, 0.0148, 0.022, 32, 1, true]} />
        <meshPhysicalMaterial
          color={BENCH_COLORS.schellbachWhite}
          depthWrite={false}
          opacity={0.42}
          roughness={0.55}
          transparent
        />
      </mesh>
      {/* Borosilicate round-bottom flask glass wall */}
      <mesh castShadow renderOrder={2}>
        <Turn profile={FLASK} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.28} />
      </mesh>
    </group>
  );
}

/**
 * Vertical borosilicate Liebig reflux condenser with cooling water jacket,
 * side coolant nipples, and flexible translucent silicone hoses looping back.
 */
export function LiebigCondenser() {
  return (
    <group>
      <group position={[AXIS_X, 0, AXIS_Z]}>
        {/* Cool circulating water inside Liebig jacket */}
        <ColumnLiquid
          bottom={0.257}
          color={ORGANIC_COLORS.alkaliCyan}
          level={0.427}
          opacity={0.3}
          radius={0.0178}
        />
        {/* Inner vapour condensation tube */}
        <mesh renderOrder={2}>
          <Turn profile={CONDENSER_TUBE} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.34} />
        </mesh>
        {/* Outer borosilicate cooling jacket */}
        <mesh castShadow renderOrder={3}>
          <Turn profile={CONDENSER_JACKET} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.25} />
        </mesh>
        {/* Lower-left coolant inlet glass barb */}
        <mesh position={[-0.027, 0.27, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0036, 0.0042, 0.02, 16]} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.4} />
        </mesh>
        {/* Upper-right coolant outlet glass barb */}
        <mesh position={[0.027, 0.416, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0042, 0.0036, 0.02, 16]} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.4} />
        </mesh>
      </group>
      {/* Translucent silicone coolant hoses */}
      <mesh castShadow>
        <Sweep ends="open" path={INLET_HOSE} radius={0.0044} />
        <meshPhysicalMaterial
          clearcoat={0.45}
          color={ORGANIC_COLORS.condenserGlass}
          opacity={0.56}
          roughness={0.32}
          transparent
        />
      </mesh>
      <mesh castShadow>
        <Sweep ends="open" path={OUTLET_HOSE} radius={0.0044} />
        <meshPhysicalMaterial
          clearcoat={0.45}
          color={ORGANIC_COLORS.condenserGlass}
          opacity={0.56}
          roughness={0.32}
          transparent
        />
      </mesh>
    </group>
  );
}
