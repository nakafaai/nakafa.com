import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import type { ContactStage } from "@repo/design-system/components/contents/chemistry/contact/model";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useEffect, useMemo } from "react";
import type { Group } from "three";
import {
  CatmullRomCurve3,
  DoubleSide,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

export const PLANT_Z = 0.03;
export const BURNER_X = -0.35;
export const CONVERTER_X = -0.12;
export const ABSORBER_X = 0.12;
export const DILUTION_X = 0.34;
export const FLASK_X = 0.495;

export function createDomeGeometry(radius: number, height: number) {
  const pts = Arr.makeBy(12, (step) => {
    const t = step / 11;
    const angle = t * (Math.PI / 2);
    return [Math.cos(angle) * radius, Math.sin(angle) * height] as const;
  });
  return new LatheGeometry(
    Arr.map(
      [[radius + 0.01, 0], [radius + 0.01, 0.012], ...pts, [0.001, height]],
      ([r, y]) => new Vector2(r, y)
    ),
    36
  );
}

export function createBurnerToConverterCurve() {
  return new CatmullRomCurve3([
    new Vector3(BURNER_X, 0.21, PLANT_Z),
    new Vector3(BURNER_X, 0.26, PLANT_Z),
    new Vector3(-0.24, 0.26, PLANT_Z),
    new Vector3(-0.22, 0.115, PLANT_Z),
    new Vector3(CONVERTER_X - 0.066, 0.115, PLANT_Z),
  ]);
}

export function createConverterToAbsorberCurve() {
  return new CatmullRomCurve3([
    new Vector3(CONVERTER_X, 0.372, PLANT_Z),
    new Vector3(CONVERTER_X, 0.41, PLANT_Z),
    new Vector3(0, 0.415, PLANT_Z),
    new Vector3(0.01, 0.12, PLANT_Z),
    new Vector3(ABSORBER_X - 0.066, 0.12, PLANT_Z),
  ]);
}

export function createAbsorberToDilutionCurve() {
  return new CatmullRomCurve3([
    new Vector3(ABSORBER_X + 0.066, 0.1, PLANT_Z),
    new Vector3(0.225, 0.1, PLANT_Z),
    new Vector3(0.235, 0.215, PLANT_Z),
    new Vector3(DILUTION_X - 0.062, 0.215, PLANT_Z),
  ]);
}

export function createOutletPipeCurve() {
  return new CatmullRomCurve3([
    new Vector3(DILUTION_X + 0.062, 0.165, PLANT_Z),
    new Vector3(0.445, 0.175, PLANT_Z + 0.006),
    new Vector3(FLASK_X, 0.172, PLANT_Z + 0.01),
    new Vector3(FLASK_X, 0.148, PLANT_Z + 0.01),
  ]);
}

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
  const topDome = useMemo(() => createDomeGeometry(0.066, 0.042), []);
  const bottomDome = useMemo(() => createDomeGeometry(0.066, 0.032), []);
  useEffect(() => () => topDome.dispose(), [topDome]);
  useEffect(() => () => bottomDome.dispose(), [bottomDome]);

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
      <mesh
        castShadow
        geometry={bottomDome}
        position={[0, 0.088, 0]}
        rotation={[Math.PI, 0, 0]}
      >
        <MetalMaterial color={PROCESS_COLORS.alloySteel} roughness={0.3} />
      </mesh>
      <mesh castShadow geometry={topDome} position={[0, 0.316, 0]}>
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
  const duct1 = useMemo(
    () =>
      new TubeGeometry(createBurnerToConverterCurve(), 48, 0.0095, 12, false),
    []
  );
  const duct2 = useMemo(
    () =>
      new TubeGeometry(createConverterToAbsorberCurve(), 56, 0.0095, 12, false),
    []
  );
  const duct3 = useMemo(
    () =>
      new TubeGeometry(createAbsorberToDilutionCurve(), 44, 0.0095, 12, false),
    []
  );
  useEffect(() => () => duct1.dispose(), [duct1]);
  useEffect(() => () => duct2.dispose(), [duct2]);
  useEffect(() => () => duct3.dispose(), [duct3]);

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
      <mesh castShadow geometry={duct1}>
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
      </mesh>
      <mesh castShadow geometry={duct2}>
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
      </mesh>
      <mesh castShadow geometry={duct3}>
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
