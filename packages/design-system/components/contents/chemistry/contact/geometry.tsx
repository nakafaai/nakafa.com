import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import type { ContactStage } from "@repo/design-system/components/contents/chemistry/contact/model";
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
import type { RefObject } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

export const PLANT_Z = 0.03;
export const BURNER_X = -0.35;
export const CONVERTER_X = -0.12;
export const ABSORBER_X = 0.12;
export const DILUTION_X = 0.34;
export const FLASK_X = 0.495;

/** How far the plant's bolting flanges stand out, and how deep they are. */
export const FLANGE = [0.01, 0.012] as const;

/** The gas duct from the burner's stack down into the converter. */
export const BURNER_DUCT: Path = [
  [BURNER_X, 0.21, PLANT_Z],
  [BURNER_X, 0.26, PLANT_Z],
  [-0.24, 0.26, PLANT_Z],
  [-0.22, 0.115, PLANT_Z],
  [CONVERTER_X - 0.066, 0.115, PLANT_Z],
];

/** The gas duct from the converter's head down into the absorber. */
export const CONVERTER_DUCT: Path = [
  [CONVERTER_X, 0.372, PLANT_Z],
  [CONVERTER_X, 0.41, PLANT_Z],
  [0, 0.415, PLANT_Z],
  [0.01, 0.12, PLANT_Z],
  [ABSORBER_X - 0.066, 0.12, PLANT_Z],
];

/** The oleum duct from the absorber up into the dilution tank. */
export const ABSORBER_DUCT: Path = [
  [ABSORBER_X + 0.066, 0.1, PLANT_Z],
  [0.225, 0.1, PLANT_Z],
  [0.235, 0.215, PLANT_Z],
  [DILUTION_X - 0.062, 0.215, PLANT_Z],
];

/** The acid outlet from the dilution tank to the receiving flask. */
export const OUTLET: Path = [
  [DILUTION_X + 0.062, 0.165, PLANT_Z],
  [0.445, 0.175, PLANT_Z + 0.006],
  [FLASK_X, 0.172, PLANT_Z + 0.01],
  [FLASK_X, 0.148, PLANT_Z + 0.01],
];

/** Process skid plate and epoxy lab benchtop. */
export function ContactPlantSkid() {
  return (
    <group>
      <LabBench width={2.8} />
      <mesh castShadow position={[-0.01, 0.006, PLANT_Z]} receiveShadow>
        <boxGeometry args={[0.86, 0.012, 0.22]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.62} />
      </mesh>
    </group>
  );
}

/** Stage 1: Refractory cylindrical sulfur burner with firebox cutaway, molten sulfur tray, and flame. */
export function SulfurBurner({
  active,
  flameRef,
}: {
  readonly active: boolean;
  readonly flameRef: RefObject<Group | null>;
}) {
  return (
    <group position={[BURNER_X, 0.012, PLANT_Z]}>
      {Arr.map([-0.042, 0.042] as const, (x) => (
        <mesh castShadow key={x} position={[x, 0.024, 0]}>
          <boxGeometry args={[0.02, 0.048, 0.11]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.55} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.105, 0]}>
        <cylinderGeometry
          args={[0.072, 0.074, 0.145, 36, 1, true, 0.65, Math.PI * 2 - 1.3]}
        />
        <MetalMaterial color={PROCESS_COLORS.ironDark} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.105, 0]}>
        <cylinderGeometry
          args={[0.062, 0.062, 0.136, 28, 1, true, 0.65, Math.PI * 2 - 1.3]}
        />
        <meshStandardMaterial
          color={PROCESS_COLORS.hotRed}
          emissive={BENCH_COLORS.coalGlow}
          emissiveIntensity={active ? 0.55 : 0.12}
          roughness={0.85}
          side={DoubleSide}
        />
      </mesh>
      <mesh castShadow position={[0, 0.036, 0]}>
        <cylinderGeometry args={[0.078, 0.078, 0.014, 32]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.52} />
      </mesh>
      <mesh castShadow position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.078, 0.078, 0.016, 32]} />
        <MetalMaterial color={PROCESS_COLORS.alloySteel} roughness={0.36} />
      </mesh>
      <mesh castShadow position={[0, 0.198, 0]}>
        <cylinderGeometry args={[0.022, 0.026, 0.022, 20]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.056, 0.008]}>
        <cylinderGeometry args={[0.052, 0.048, 0.016, 24]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.sulfurYellow}
          emissive={PROCESS_COLORS.sulfurYellow}
          emissiveIntensity={active ? 0.75 : 0.2}
          roughness={0.35}
        />
      </mesh>
      <group
        position={[0, 0.095, 0.01]}
        ref={flameRef}
        scale={active ? [1.22, 1.35, 1.22] : [0.75, 0.72, 0.75]}
      >
        <mesh>
          <coneGeometry args={[0.028, 0.064, 16]} />
          <meshStandardMaterial
            color={PROCESS_COLORS.vanadiumOrange}
            emissive={BENCH_COLORS.coalGlow}
            emissiveIntensity={active ? 1.8 : 0.45}
            opacity={0.86}
            transparent
          />
        </mesh>
        <mesh position={[0, -0.008, 0.004]}>
          <coneGeometry args={[0.016, 0.042, 14]} />
          <meshStandardMaterial
            color={BENCH_COLORS.coalGlow}
            emissive={BENCH_COLORS.coalGlow}
            emissiveIntensity={active ? 2.2 : 0.6}
          />
        </mesh>
      </group>
      {active ? (
        <pointLight
          color={BENCH_COLORS.coalGlow}
          distance={0.36}
          intensity={0.55}
          position={[0, 0.11, 0.06]}
        />
      ) : null}
    </group>
  );
}

/** Stage 2: Bolted stainless catalytic converter tower with 4 porous V2O5 beds behind sight glass. */
export function VanadiumConverter({ active }: { readonly active: boolean }) {
  const beds = [0.112, 0.164, 0.216, 0.268] as const;
  const legs = Arr.makeBy(4, (step) => (step / 4) * Math.PI * 2 + Math.PI / 4);
  const bolts = Arr.makeBy(10, (step) => (step / 10) * Math.PI * 2);

  return (
    <group position={[CONVERTER_X, 0.012, PLANT_Z]}>
      {Arr.map(legs, (ang) => (
        <mesh
          castShadow
          key={ang}
          position={[Math.cos(ang) * 0.052, 0.036, Math.sin(ang) * 0.052]}
        >
          <cylinderGeometry args={[0.006, 0.0075, 0.072, 12]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.088, 0]} rotation={[Math.PI, 0, 0]}>
        <Turn profile={head(0.066, 0.032, FLANGE)} />
        <MetalMaterial color={PROCESS_COLORS.alloySteel} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.316, 0]}>
        <Turn profile={head(0.066, 0.042, FLANGE)} />
        <MetalMaterial color={PROCESS_COLORS.alloySteel} roughness={0.3} />
      </mesh>
      {Arr.map(bolts, (ang) => (
        <mesh
          key={ang}
          position={[Math.cos(ang) * 0.072, 0.322, Math.sin(ang) * 0.072]}
        >
          <cylinderGeometry args={[0.0032, 0.0032, 0.008, 6]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.24} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.202, 0]}>
        <cylinderGeometry
          args={[0.066, 0.066, 0.228, 36, 1, true, 0.58, Math.PI * 2 - 1.16]}
        />
        <MetalMaterial color={PROCESS_COLORS.alloySteel} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.202, 0]}>
        <cylinderGeometry
          args={[0.06, 0.06, 0.226, 28, 1, true, 0.58, Math.PI * 2 - 1.16]}
        />
        <meshStandardMaterial
          color={CAR_COLORS.castIron}
          roughness={0.72}
          side={DoubleSide}
        />
      </mesh>
      {Arr.map(beds, (y) => (
        <group key={y} position={[0, y, 0]}>
          <mesh>
            <cylinderGeometry args={[0.056, 0.056, 0.007, 24]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.36} />
          </mesh>
          <mesh position={[0, 0.011, 0]}>
            <cylinderGeometry args={[0.053, 0.053, 0.016, 24]} />
            <meshStandardMaterial
              color={PROCESS_COLORS.vanadiumOrange}
              emissive={PROCESS_COLORS.vanadiumOrange}
              emissiveIntensity={active ? 1.35 : 0.22}
              roughness={0.52}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.202, 0]}>
        <cylinderGeometry
          args={[0.0655, 0.0655, 0.222, 22, 1, true, -0.56, 1.12]}
        />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.22} />
      </mesh>
      {active ? (
        <pointLight
          color={PROCESS_COLORS.vanadiumOrange}
          distance={0.36}
          intensity={0.5}
          position={[0, 0.2, 0.06]}
        />
      ) : null}
    </group>
  );
}

/** Curved flanged interconnecting stainless gas/oleum ducts with brass valve wheels. */
export function StageDucts({ stage }: { readonly stage: ContactStage }) {
  const activeXByStage: Record<ContactStage, number> = {
    catalyticOxidation: CONVERTER_X,
    dilution: DILUTION_X,
    oleumAbsorption: ABSORBER_X,
    roasting: BURNER_X,
  };
  const activeColorByStage: Record<ContactStage, string> = {
    catalyticOxidation: PROCESS_COLORS.vanadiumOrange,
    dilution: PROCESS_COLORS.catalystTeal,
    oleumAbsorption: PROCESS_COLORS.oleumAmber,
    roasting: PROCESS_COLORS.sulfurYellow,
  };
  const activeX = activeXByStage[stage];
  const activeColor = activeColorByStage[stage];

  return (
    <group>
      <mesh castShadow>
        <Sweep path={BURNER_DUCT} radius={0.0095} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
      </mesh>
      <mesh castShadow>
        <Sweep path={CONVERTER_DUCT} radius={0.0095} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
      </mesh>
      <mesh castShadow>
        <Sweep path={ABSORBER_DUCT} radius={0.0095} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
      </mesh>
      {Arr.map(
        [
          [-0.24, 0.26],
          [0, 0.415],
          [0.23, 0.155],
        ] as const,
        ([x, y]) => (
          <group key={`${x}-${y}`} position={[x, y, PLANT_Z]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.015, 0.015, 0.01, 18]} />
              <MetalMaterial color={CAR_COLORS.castIron} roughness={0.44} />
            </mesh>
            <mesh position={[0, 0.022, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.013, 0.0026, 8, 20]} />
              <MetalMaterial
                color={PROCESS_COLORS.electronGold}
                roughness={0.28}
              />
            </mesh>
          </group>
        )
      )}
      <mesh position={[activeX, 0.014, PLANT_Z]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.078, 0.0038, 10, 40]} />
        <meshStandardMaterial
          color={activeColor}
          emissive={activeColor}
          emissiveIntensity={1.2}
        />
      </mesh>
    </group>
  );
}
