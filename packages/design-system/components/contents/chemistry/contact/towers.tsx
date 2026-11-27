import {
  ColumnLiquid,
  Flask,
  FlaskLiquid,
} from "@repo/design-system/components/contents/chemistry/bench";
import {
  ABSORBER_X,
  DILUTION_X,
  FLANGE,
  FLASK_X,
  OUTLET,
  PLANT_Z,
} from "@repo/design-system/components/contents/chemistry/contact/geometry";
import { head } from "@repo/design-system/components/three/form/outline";
import { Sweep, Turn } from "@repo/design-system/components/three/form/part";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { DoubleSide } from "three";

/** Stage 3: Packed borosilicate absorption tower with Raschig rings, spray nozzle, and oleum sump. */
export function AbsorptionTower({ active }: { readonly active: boolean }) {
  const ringLayers = [0.145, 0.195, 0.245] as const;
  const ringSlots = Arr.makeBy(6, (step) => (step / 6) * Math.PI * 2);
  const tieRods = Arr.makeBy(
    4,
    (step) => (step / 4) * Math.PI * 2 + Math.PI / 4
  );

  return (
    <group position={[ABSORBER_X, 0.012, PLANT_Z]}>
      {Arr.map(tieRods, (ang) => (
        <mesh
          castShadow
          key={`leg-${ang}`}
          position={[Math.cos(ang) * 0.052, 0.025, Math.sin(ang) * 0.052]}
        >
          <cylinderGeometry args={[0.0055, 0.007, 0.05, 12]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.052, 0]}>
        <cylinderGeometry args={[0.072, 0.072, 0.016, 32]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.354, 0]}>
        <cylinderGeometry args={[0.072, 0.072, 0.016, 32]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
      </mesh>
      {Arr.map(tieRods, (ang) => (
        <mesh
          key={`tie-${ang}`}
          position={[Math.cos(ang) * 0.066, 0.204, Math.sin(ang) * 0.066]}
        >
          <cylinderGeometry args={[0.0024, 0.0024, 0.302, 10]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
        </mesh>
      ))}
      <mesh position={[0, 0.324, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.036, 0.004, 10, 24]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.312, 0]}>
        <coneGeometry args={[0.044, 0.026, 20, 1, true]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.oleumAmber}
          emissive={PROCESS_COLORS.oleumAmber}
          emissiveIntensity={active ? 0.6 : 0.15}
          opacity={active ? 0.45 : 0.22}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {Arr.map(ringLayers, (y, layerIdx) => (
        <group key={y} position={[0, y, 0]}>
          {Arr.map(ringSlots, (ang) => {
            const offset = layerIdx * 0.5;
            return (
              <mesh
                key={`${y}-${ang}`}
                position={[
                  Math.cos(ang + offset) * 0.032,
                  0,
                  Math.sin(ang + offset) * 0.032,
                ]}
                rotation={[0.35, ang, 0.25]}
              >
                <cylinderGeometry args={[0.012, 0.012, 0.022, 14, 1, true]} />
                <meshStandardMaterial
                  color={BENCH_COLORS.ceramicTile}
                  roughness={0.55}
                  side={DoubleSide}
                />
              </mesh>
            );
          })}
        </group>
      ))}
      <ColumnLiquid
        bottom={0.06}
        color={PROCESS_COLORS.oleumAmber}
        level={active ? 0.118 : 0.098}
        opacity={0.78}
        radius={0.056}
      />
      <mesh position={[0, 0.203, 0]}>
        <cylinderGeometry args={[0.062, 0.062, 0.292, 36, 1, true]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.23} />
      </mesh>
      {active ? (
        <pointLight
          color={PROCESS_COLORS.oleumAmber}
          distance={0.34}
          intensity={0.42}
          position={[0, 0.21, 0.06]}
        />
      ) : null}
    </group>
  );
}

/** Stage 4: Domed oleum dilution tank, curved stainless outlet with valve, and benchtop receiving flask. */
export function DilutionUnit({ active }: { readonly active: boolean }) {
  const legs = Arr.makeBy(3, (step) => (step / 3) * Math.PI * 2 + 0.5);

  return (
    <group>
      <group position={[DILUTION_X, 0.012, PLANT_Z]}>
        {Arr.map(legs, (ang) => (
          <mesh
            castShadow
            key={ang}
            position={[Math.cos(ang) * 0.048, 0.024, Math.sin(ang) * 0.048]}
          >
            <cylinderGeometry args={[0.006, 0.0075, 0.048, 12]} />
            <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
          </mesh>
        ))}
        <mesh castShadow position={[0, 0.052, 0]}>
          <cylinderGeometry args={[0.066, 0.066, 0.014, 32]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.32} />
        </mesh>
        <mesh castShadow position={[0, 0.242, 0]}>
          <Turn profile={head(0.062, 0.038, FLANGE)} />
          <MetalMaterial color={PROCESS_COLORS.alloySteel} roughness={0.3} />
        </mesh>
        <mesh castShadow position={[0, 0.148, 0]}>
          <cylinderGeometry
            args={[0.062, 0.062, 0.184, 36, 1, true, 0.48, Math.PI * 2 - 0.96]}
          />
          <MetalMaterial color={PROCESS_COLORS.alloySteel} roughness={0.32} />
        </mesh>
        <mesh position={[-0.022, 0.282, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.036, 14]} />
          <MetalMaterial color={PROCESS_COLORS.catalystTeal} roughness={0.32} />
        </mesh>
        <mesh position={[-0.022, 0.302, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.012, 0.0026, 8, 20]} />
          <MetalMaterial color={PROCESS_COLORS.catalystTeal} roughness={0.3} />
        </mesh>
        <ColumnLiquid
          bottom={0.06}
          color={PROCESS_COLORS.oleumAmber}
          level={active ? 0.195 : 0.155}
          opacity={0.78}
          radius={0.055}
        />
        <mesh position={[0, 0.148, 0]}>
          <cylinderGeometry
            args={[0.0615, 0.0615, 0.18, 20, 1, true, -0.46, 0.92]}
          />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.24} />
        </mesh>
        {active ? (
          <pointLight
            color={PROCESS_COLORS.catalystTeal}
            distance={0.35}
            intensity={0.45}
            position={[0.04, 0.16, 0.07]}
          />
        ) : null}
      </group>
      <mesh castShadow>
        <Sweep path={OUTLET} radius={0.008} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.24} />
      </mesh>
      <group position={[0.445, 0.175, PLANT_Z + 0.006]}>
        <mesh>
          <cylinderGeometry args={[0.011, 0.011, 0.02, 16]} />
          <MetalMaterial color={PROCESS_COLORS.electronGold} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.022, 0]}>
          <cylinderGeometry args={[0.0032, 0.0032, 0.022, 12]} />
          <MetalMaterial color={PROCESS_COLORS.electronGold} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0.032, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.016, 0.0032, 10, 22]} />
          <MetalMaterial color={PROCESS_COLORS.hotRed} roughness={0.34} />
        </mesh>
      </group>
      <group position={[FLASK_X, 0, PLANT_Z + 0.01]}>
        <Flask />
        <FlaskLiquid
          color={PROCESS_COLORS.oleumAmber}
          level={active ? 0.074 : 0.046}
          opacity={0.78}
        />
      </group>
    </group>
  );
}
