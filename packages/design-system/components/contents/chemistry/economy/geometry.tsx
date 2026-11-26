import {
  Beaker,
  ColumnLiquid,
  Flask,
  FlaskLiquid,
} from "@repo/design-system/components/contents/chemistry/bench";
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
export const HOPPER_POS = [-0.23, 0, 0.02] as const;
export const PRODUCT_FLASK_POS = [0.16, 0, -0.025] as const;
export const WASTE_BEAKER_POS = [0.255, 0, 0.068] as const;

const HOPPER_LEG_ANGLES = Arr.makeBy(3, (index) => (index / 3) * Math.PI * 2);

const WASTE_CHUNKS = [
  { id: "chunk-0", r: 0.0056, x: -0.009, y: 0.012, z: 0.006 },
  { id: "chunk-1", r: 0.0052, x: 0.008, y: 0.013, z: -0.005 },
  { id: "chunk-2", r: 0.0054, x: 0.001, y: 0.019, z: 0.007 },
  { id: "chunk-3", r: 0.005, x: -0.007, y: 0.022, z: -0.006 },
] as const;

export function createFeedCurve() {
  return new CatmullRomCurve3([
    new Vector3(-0.23, 0.118, 0.02),
    new Vector3(-0.205, 0.112, 0.02),
    new Vector3(-0.135, 0.116, 0.02),
    new Vector3(-0.082, 0.128, 0.02),
    new Vector3(-0.048, 0.132, 0.02),
  ]);
}

export function createProductCurve() {
  return new CatmullRomCurve3([
    new Vector3(0.032, 0.204, 0.015),
    new Vector3(0.088, 0.232, -0.002),
    new Vector3(0.145, 0.214, -0.02),
    new Vector3(0.16, 0.184, -0.025),
    new Vector3(0.16, 0.156, -0.025),
  ]);
}

export function createWasteCurve() {
  return new CatmullRomCurve3([
    new Vector3(0.034, 0.088, 0.032),
    new Vector3(0.108, 0.094, 0.05),
    new Vector3(0.188, 0.112, 0.064),
    new Vector3(0.244, 0.104, 0.068),
    new Vector3(0.255, 0.078, 0.068),
  ]);
}

export function createDomeCapGeometry() {
  const profile = Arr.map(
    [
      [0.038, 0],
      [0.038, 0.007],
      [0.033, 0.017],
      [0.021, 0.024],
      [0.008, 0.027],
      [0.0005, 0.027],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 36);
}

function createHopperGeometry() {
  const profile = Arr.map(
    [
      [0.009, 0.106],
      [0.012, 0.116],
      [0.022, 0.138],
      [0.038, 0.174],
      [0.045, 0.206],
      [0.049, 0.212],
      [0.045, 0.214],
      [0.041, 0.205],
      [0.034, 0.174],
      [0.018, 0.138],
      [0.009, 0.114],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 44);
}

/** Conical stainless reactant feed hopper on tripod legs with flanged manifold and brass handwheel. */
export function FeedHopperManifold() {
  const { feedTubeGeo, hopperGeo } = useMemo(() => {
    const feedCurve = createFeedCurve();
    return {
      feedTubeGeo: new TubeGeometry(feedCurve, 36, 0.0056, 14, false),
      hopperGeo: createHopperGeometry(),
    };
  }, []);

  useEffect(
    () => () => {
      feedTubeGeo.dispose();
      hopperGeo.dispose();
    },
    [feedTubeGeo, hopperGeo]
  );

  return (
    <group>
      {/* Tripod stand and conical stainless feed hopper */}
      <group position={HOPPER_POS}>
        <mesh castShadow position={[0, 0.005, 0]} receiveShadow>
          <cylinderGeometry args={[0.044, 0.048, 0.01, 32]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.58} />
        </mesh>
        {Arr.map(HOPPER_LEG_ANGLES, (angle) => (
          <mesh
            castShadow
            key={`hopper-leg-${angle}`}
            position={[Math.cos(angle) * 0.032, 0.072, Math.sin(angle) * 0.032]}
            rotation={[Math.sin(angle) * 0.06, 0, -Math.cos(angle) * 0.06]}
          >
            <cylinderGeometry args={[0.0036, 0.0044, 0.132, 12]} />
            <MetalMaterial color={CAR_COLORS.castIron} roughness={0.52} />
          </mesh>
        ))}
        {/* Mid-height support collar */}
        <mesh position={[0, 0.138, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.025, 0.0032, 10, 32]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.34} />
        </mesh>
        {/* Turned stainless hopper cone */}
        <mesh castShadow geometry={hopperGeo} receiveShadow>
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
        </mesh>
        {/* Glowing cyan reactant charge inside hopper mouth */}
        <mesh position={[0, 0.194, 0]}>
          <cylinderGeometry args={[0.039, 0.028, 0.024, 32]} />
          <meshPhysicalMaterial
            clearcoat={0.7}
            color={PROCESS_COLORS.ammoniaCyan}
            emissive={PROCESS_COLORS.ammoniaCyan}
            emissiveIntensity={0.18}
            roughness={0.24}
          />
        </mesh>
      </group>

      {/* Curved flanged stainless feed manifold */}
      <mesh castShadow geometry={feedTubeGeo}>
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
      </mesh>
      {/* Inlet and outlet pipe flanges */}
      <mesh position={[-0.192, 0.112, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.011, 0.011, 0.006, 20]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.24} />
      </mesh>
      <mesh position={[-0.056, 0.132, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.011, 0.011, 0.006, 20]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.24} />
      </mesh>

      {/* Brass gate valve with spoked handwheel */}
      <group position={[-0.135, 0.116, 0.02]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.0105, 0.0105, 0.016, 18]} />
          <MetalMaterial
            color={BENCH_COLORS.batteryTerminal}
            roughness={0.34}
          />
        </mesh>
        <mesh position={[0, 0.016, 0]}>
          <cylinderGeometry args={[0.0028, 0.0028, 0.018, 12]} />
          <MetalMaterial
            color={BENCH_COLORS.batteryTerminal}
            roughness={0.34}
          />
        </mesh>
        <mesh position={[0, 0.026, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.015, 0.0024, 10, 24]} />
          <MetalMaterial color={PROCESS_COLORS.alloyBronze} roughness={0.34} />
        </mesh>
        <mesh position={[0, 0.026, 0]}>
          <boxGeometry args={[0.028, 0.0022, 0.0022]} />
          <MetalMaterial color={PROCESS_COLORS.alloyBronze} roughness={0.34} />
        </mesh>
        <mesh position={[0, 0.026, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.028, 0.0022, 0.0022]} />
          <MetalMaterial color={PROCESS_COLORS.alloyBronze} roughness={0.34} />
        </mesh>
      </group>
    </group>
  );
}

/** Upper product delivery tube + conical flask and lower drain pipe + byproduct waste beaker. */
export function ProductAndWasteStations({
  economyPercent,
  wasteSpheres,
}: {
  readonly economyPercent: number;
  readonly wasteSpheres: number;
}) {
  const { productTubeGeo, wasteTubeGeo } = useMemo(() => {
    const productCurve = createProductCurve();
    const wasteCurve = createWasteCurve();
    return {
      productTubeGeo: new TubeGeometry(productCurve, 44, 0.0046, 12, false),
      wasteTubeGeo: new TubeGeometry(wasteCurve, 40, 0.0044, 12, false),
    };
  }, []);

  useEffect(
    () => () => {
      productTubeGeo.dispose();
      wasteTubeGeo.dispose();
    },
    [productTubeGeo, wasteTubeGeo]
  );

  const economyFraction = Math.min(1, Math.max(0, (economyPercent - 45) / 55));
  const productLevel = 0.024 + economyFraction * 0.072;
  const hasWaste = wasteSpheres > 0;
  const wasteLevel = 0.02 + (wasteSpheres / 4) * 0.036;
  const visibleChunks = Arr.take(WASTE_CHUNKS, wasteSpheres);

  return (
    <group>
      {/* Curved borosilicate delivery tube to desired product flask */}
      <mesh geometry={productTubeGeo} renderOrder={2}>
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.38} />
      </mesh>

      {/* Lower stainless drain pipe to byproduct waste beaker */}
      <mesh castShadow geometry={wasteTubeGeo}>
        <MetalMaterial
          color={hasWaste ? BENCH_COLORS.panSteel : CAR_COLORS.castIron}
          roughness={hasWaste ? 0.32 : 0.56}
        />
      </mesh>

      {/* Red closed shutoff valve on waste line when 100% atom economy addition route */}
      {hasWaste ? null : (
        <group position={[0.132, 0.1, 0.055]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.0085, 0.0085, 0.013, 16]} />
            <meshStandardMaterial
              color={PROCESS_COLORS.hotRed}
              roughness={0.36}
            />
          </mesh>
          <mesh position={[0, 0.01, 0]}>
            <boxGeometry args={[0.022, 0.0036, 0.004]} />
            <meshStandardMaterial
              color={PROCESS_COLORS.hotRed}
              roughness={0.36}
            />
          </mesh>
        </group>
      )}

      {/* Desired product conical flask on white ceramic tile */}
      <group position={PRODUCT_FLASK_POS}>
        <mesh position={[0, 0.0025, 0]} receiveShadow>
          <cylinderGeometry args={[0.052, 0.054, 0.005, 32]} />
          <meshStandardMaterial
            color={BENCH_COLORS.ceramicTile}
            roughness={0.44}
          />
        </mesh>
        <group position={[0, 0.005, 0]}>
          <FlaskLiquid
            color={PROCESS_COLORS.greenProduct}
            level={productLevel}
            opacity={0.82}
          />
          <Flask />
        </group>
      </group>

      {/* Byproduct waste benchtop Griffin beaker */}
      <group position={WASTE_BEAKER_POS}>
        {hasWaste ? (
          <group>
            <ColumnLiquid
              bottom={0.0038}
              color={PROCESS_COLORS.wasteSlate}
              level={wasteLevel}
              opacity={0.84}
              radius={0.0235}
            />
            {Arr.map(visibleChunks, (chunk) => (
              <mesh
                castShadow
                key={chunk.id}
                position={[chunk.x, chunk.y, chunk.z]}
                rotation={[chunk.x * 40, chunk.y * 55, chunk.z * 30]}
              >
                <dodecahedronGeometry args={[chunk.r, 0]} />
                <meshStandardMaterial
                  color={CAR_COLORS.rimDark}
                  roughness={0.86}
                />
              </mesh>
            ))}
          </group>
        ) : null}
        <Beaker />
      </group>
    </group>
  );
}
