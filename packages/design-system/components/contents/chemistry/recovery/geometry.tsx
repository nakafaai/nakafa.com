import {
  ColumnLiquid,
  Flask,
  FlaskLiquid,
} from "@repo/design-system/components/contents/chemistry/bench";
import type { CatalysisMode } from "@repo/design-system/components/contents/chemistry/recovery/model";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

export const REACTOR_X = -0.01;
export const REACTOR_Z = 0.02;
export const PRODUCT_FLASK_POS = [0.155, 0.005, -0.025] as const;
export const WASTE_CARBOY_POS = [0.255, 0, 0.068] as const;

const CARBOY_TICKS = [0.024, 0.044, 0.064, 0.084, 0.102] as const;

export function createFeedCurve() {
  return new CatmullRomCurve3([
    new Vector3(-0.194, 0.105, 0.02),
    new Vector3(-0.145, 0.105, 0.02),
    new Vector3(-0.092, 0.1, 0.02),
    new Vector3(-0.052, 0.096, 0.02),
  ]);
}

export function createRecoveryCurve() {
  return new CatmullRomCurve3(
    [
      new Vector3(0.008, 0.23, 0.02),
      new Vector3(0.036, 0.304, 0.01),
      new Vector3(0.035, 0.26, 0.01),
      new Vector3(-0.018, 0.278, 0.014),
      new Vector3(-0.062, 0.258, 0.018),
      new Vector3(-0.066, 0.205, 0.02),
      new Vector3(-0.044, 0.19, 0.02),
    ],
    false
  );
}

export function createProductCurve() {
  return new CatmullRomCurve3([
    new Vector3(0.035, 0.342, 0.01),
    new Vector3(0.092, 0.346, -0.004),
    new Vector3(0.142, 0.295, -0.018),
    new Vector3(0.155, 0.22, -0.025),
    new Vector3(0.155, 0.154, -0.025),
  ]);
}

function createWasteCurve() {
  return new CatmullRomCurve3([
    new Vector3(0.034, 0.072, 0.028),
    new Vector3(0.105, 0.09, 0.048),
    new Vector3(0.195, 0.168, 0.066),
    new Vector3(0.246, 0.165, 0.068),
    new Vector3(0.255, 0.146, 0.068),
  ]);
}

export function createDomeCapGeometry() {
  const profile = Arr.map(
    [
      [0.036, 0],
      [0.036, 0.008],
      [0.031, 0.018],
      [0.02, 0.025],
      [0.008, 0.028],
      [0.0005, 0.028],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 36);
}

function createCycloneGeometry() {
  const profile = Arr.map(
    [
      [0.0045, -0.045],
      [0.0065, -0.042],
      [0.025, -0.002],
      [0.026, 0.03],
      [0.011, 0.032],
      [0.01, 0.044],
      [0.0075, 0.044],
      [0.0075, 0.03],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 40);
}

function createCarboyGeometry() {
  const profile = Arr.map(
    [
      [0.001, 0],
      [0.042, 0],
      [0.046, 0.005],
      [0.046, 0.108],
      [0.042, 0.118],
      [0.02, 0.132],
      [0.018, 0.144],
      [0.0205, 0.146],
      [0.0165, 0.146],
      [0.0165, 0.13],
      [0.044, 0.106],
      [0.044, 0.004],
      [0.001, 0.004],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 48);
}

/** Overhead stainless cyclone separator, closed recovery loop, and product/waste tubing. */
export function CycloneAndTubing({ active }: { readonly active: boolean }) {
  const { cycloneGeo, productGeo, recoveryGeo, wasteGeo } = useMemo(() => {
    const recoveryCurve = createRecoveryCurve();
    const productCurve = createProductCurve();
    const wasteCurve = createWasteCurve();
    return {
      cycloneGeo: createCycloneGeometry(),
      productGeo: new TubeGeometry(productCurve, 40, 0.0042, 12, false),
      recoveryGeo: new TubeGeometry(recoveryCurve, 56, 0.0052, 14, false),
      wasteGeo: new TubeGeometry(wasteCurve, 40, 0.0046, 12, false),
    };
  }, []);

  useEffect(
    () => () => {
      cycloneGeo.dispose();
      productGeo.dispose();
      recoveryGeo.dispose();
      wasteGeo.dispose();
    },
    [cycloneGeo, productGeo, recoveryGeo, wasteGeo]
  );

  return (
    <group>
      {/* Conical stainless cyclone separator */}
      <mesh castShadow geometry={cycloneGeo} position={[0.035, 0.3, 0.01]}>
        <MetalMaterial
          color={active ? BENCH_COLORS.panSteel : CAR_COLORS.castIron}
          roughness={active ? 0.25 : 0.55}
        />
      </mesh>
      {/* Recovery loop tubing (dimmed when stoichiometric shutoff is engaged) */}
      <mesh castShadow geometry={recoveryGeo}>
        <meshPhysicalMaterial
          clearcoat={active ? 0.5 : 0.1}
          color={active ? PROCESS_COLORS.catalystTeal : CAR_COLORS.hub}
          metalness={active ? 0.65 : 0.35}
          opacity={active ? 0.94 : 0.45}
          roughness={active ? 0.26 : 0.65}
          transparent
        />
      </mesh>
      {/* Red shutoff valve on recovery loop when stoichiometric */}
      {active ? null : (
        <group position={[-0.064, 0.23, 0.019]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.009, 0.009, 0.014, 16]} />
            <meshStandardMaterial
              color={PROCESS_COLORS.hotRed}
              roughness={0.38}
            />
          </mesh>
          <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.024, 0.004, 0.004]} />
            <meshStandardMaterial
              color={PROCESS_COLORS.hotRed}
              roughness={0.35}
            />
          </mesh>
        </group>
      )}
      {/* Curved borosilicate product delivery arm */}
      <mesh geometry={productGeo} renderOrder={2}>
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.35} />
      </mesh>
      {/* Side waste drain tube to carboy */}
      <mesh castShadow geometry={wasteGeo}>
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.48} />
      </mesh>
    </group>
  );
}

/** Right-side green product conical flask and graduated glass waste carboy. */
export function ProductAndWasteVessels({
  mode,
  productLevel,
  wasteLevel,
}: {
  readonly mode: CatalysisMode;
  readonly productLevel: number;
  readonly wasteLevel: number;
}) {
  const carboyGeo = useMemo(createCarboyGeometry, []);
  useEffect(() => () => carboyGeo.dispose(), [carboyGeo]);

  return (
    <group>
      {/* Product Erlenmeyer flask on ceramic pad */}
      <group position={[PRODUCT_FLASK_POS[0], 0, PRODUCT_FLASK_POS[2]]}>
        <mesh position={[0, 0.0025, 0]} receiveShadow>
          <cylinderGeometry args={[0.052, 0.054, 0.005, 32]} />
          <meshStandardMaterial
            color={BENCH_COLORS.ceramicTile}
            roughness={0.45}
          />
        </mesh>
        <group position={[0, 0.005, 0]}>
          <FlaskLiquid
            color={PROCESS_COLORS.greenProduct}
            level={productLevel}
            opacity={0.8}
          />
          <Flask />
        </group>
      </group>

      {/* Graduated borosilicate waste carboy */}
      <group position={WASTE_CARBOY_POS}>
        <ColumnLiquid
          bottom={0.0045}
          color={PROCESS_COLORS.wasteSlate}
          level={wasteLevel}
          opacity={mode === "stoichiometric" ? 0.92 : 0.78}
          radius={0.0425}
        />
        {mode === "stoichiometric" ? (
          <mesh position={[0, 0.011, 0]}>
            <cylinderGeometry args={[0.041, 0.041, 0.012, 32]} />
            <meshStandardMaterial color={CAR_COLORS.rimDark} roughness={0.88} />
          </mesh>
        ) : null}
        <mesh castShadow geometry={carboyGeo} renderOrder={2}>
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.28} />
        </mesh>
        {/* Carboy screw collar */}
        <mesh position={[0, 0.141, 0]}>
          <cylinderGeometry args={[0.021, 0.021, 0.01, 24, 1, true]} />
          <meshStandardMaterial
            color={BENCH_COLORS.bottleCap}
            roughness={0.6}
          />
        </mesh>
        {/* Enamel graduation ticks */}
        {Arr.map(CARBOY_TICKS, (y, index) => (
          <mesh key={y} position={[0, y, 0.0462]}>
            <boxGeometry
              args={[index % 2 === 0 ? 0.014 : 0.008, 0.0012, 0.0005]}
            />
            <meshBasicMaterial color={BENCH_COLORS.schellbachWhite} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
