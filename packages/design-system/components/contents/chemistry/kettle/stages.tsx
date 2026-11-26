import { useFrame } from "@react-three/fiber";
import {
  Beaker,
  ColumnLiquid,
} from "@repo/design-system/components/contents/chemistry/bench";
import {
  KETTLE_RADIUS,
  KETTLE_Z,
} from "@repo/design-system/components/contents/chemistry/kettle/vessel";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  CatmullRomCurve3,
  DoubleSide,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

const DROP_INDICES = Arr.range(0, 5);
const SALT_INDICES = Arr.range(0, 9);
const STRAINER_BARS = Arr.range(0, 7);

/** Smooth pouring stream of aqueous NaOH during hydrolysis. */
function buildAlkaliPourGeometry(): TubeGeometry {
  const curve = new CatmullRomCurve3([
    new Vector3(-0.072, 0.352, KETTLE_Z),
    new Vector3(-0.052, 0.305, KETTLE_Z),
    new Vector3(-0.044, 0.242, KETTLE_Z),
  ]);
  return new TubeGeometry(curve, 24, 0.0045, 12, false);
}

/** Rounded floating soap curd cake geometry. */
function buildCurdDiskGeometry(height: number): LatheGeometry {
  const r = KETTLE_RADIUS - 0.01;
  const points = Arr.map(
    [
      [0.001, 0],
      [r - 0.005, 0],
      [r, 0.008],
      [r, Math.max(0.016, height - 0.01)],
      [r - 0.008, height],
      [0.001, height + 0.004],
    ] as const,
    ([radius, y]) => new Vector2(radius, y)
  );
  return new LatheGeometry(points, 36);
}

/** Hydrolysis contents: golden triglyceride oil and pouring shimmering NaOH stream. */
export function HydrolysisContents({ playing }: { readonly playing: boolean }) {
  const pourGeo = useMemo(buildAlkaliPourGeometry, []);
  const dropsRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  useEffect(() => () => pourGeo.dispose(), [pourGeo]);

  useFrame((_, delta) => {
    const container = dropsRef.current;
    if (!playing || container === null) {
      return;
    }
    phaseRef.current = (phaseRef.current + simulationStep(delta) * 1.4) % 1;
    for (const index of DROP_INDICES) {
      const drop = container.children[index];
      if (drop !== undefined) {
        const u = (phaseRef.current + index / DROP_INDICES.length) % 1;
        drop.position.set(
          -0.072 + u * 0.028,
          0.35 - u * 0.11,
          KETTLE_Z + Math.sin(u * Math.PI) * 0.006
        );
      }
    }
  });

  return (
    <group>
      <group position={[0, 0, KETTLE_Z]}>
        <ColumnLiquid
          bottom={0.118}
          color={ORGANIC_COLORS.triglycerideGold}
          level={0.245}
          opacity={0.78}
          radius={KETTLE_RADIUS - 0.01}
        />
        <mesh position={[0, 0.248, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[KETTLE_RADIUS - 0.02, 0.007, 10, 32]} />
          <meshStandardMaterial
            color={ORGANIC_COLORS.soapCream}
            opacity={0.72}
            roughness={0.5}
            transparent
          />
        </mesh>
      </group>
      <mesh geometry={pourGeo}>
        <meshPhysicalMaterial
          clearcoat={1}
          color={ORGANIC_COLORS.alkaliCyan}
          emissive={ORGANIC_COLORS.alkaliCyan}
          emissiveIntensity={0.4}
          opacity={0.78}
          roughness={0.08}
          transparent
        />
      </mesh>
      <group ref={dropsRef}>
        {Arr.map(DROP_INDICES, (index) => {
          const u = index / DROP_INDICES.length;
          return (
            <mesh
              key={index}
              position={[-0.072 + u * 0.028, 0.35 - u * 0.11, KETTLE_Z]}
            >
              <sphereGeometry args={[0.0055, 10, 8]} />
              <meshStandardMaterial
                color={ORGANIC_COLORS.alkaliCyan}
                emissive={ORGANIC_COLORS.alkaliCyan}
                emissiveIntensity={0.6}
                roughness={0.15}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** Salting-out contents: side salt chute, falling cubic NaCl crystals, brine and floating curd. */
export function SaltingOutContents({
  curdHeight,
  playing,
}: {
  readonly curdHeight: number;
  readonly playing: boolean;
}) {
  const curdGeo = useMemo(
    () => buildCurdDiskGeometry(curdHeight * 0.28),
    [curdHeight]
  );
  const crystalsRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  useEffect(() => () => curdGeo.dispose(), [curdGeo]);

  useFrame((_, delta) => {
    const container = crystalsRef.current;
    if (!playing || container === null) {
      return;
    }
    phaseRef.current = (phaseRef.current + simulationStep(delta) * 1.1) % 1;
    for (const index of SALT_INDICES) {
      const crystal = container.children[index];
      if (crystal !== undefined) {
        const u = (phaseRef.current + index / SALT_INDICES.length) % 1;
        crystal.position.set(
          0.11 - u * 0.055,
          0.355 - u * 0.095,
          KETTLE_Z + ((index % 3) - 1) * 0.012
        );
        crystal.rotation.set(u * 4 + index, u * 3, index);
      }
    }
  });

  return (
    <group>
      <group position={[0, 0, KETTLE_Z]}>
        <ColumnLiquid
          bottom={0.118}
          color={ORGANIC_COLORS.waterBlue}
          level={0.205}
          opacity={0.64}
          radius={KETTLE_RADIUS - 0.01}
        />
        <mesh castShadow geometry={curdGeo} position={[0, 0.205, 0]}>
          <meshStandardMaterial
            color={ORGANIC_COLORS.soapCream}
            roughness={0.48}
          />
        </mesh>
        <mesh position={[0.145, 0.375, 0]} rotation={[0, 0, 0.55]}>
          <boxGeometry args={[0.11, 0.016, 0.044]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
        </mesh>
      </group>
      <group ref={crystalsRef}>
        {Arr.map(SALT_INDICES, (index) => {
          const u = index / SALT_INDICES.length;
          return (
            <mesh
              key={index}
              position={[
                0.11 - u * 0.055,
                0.355 - u * 0.095,
                KETTLE_Z + ((index % 3) - 1) * 0.012,
              ]}
              rotation={[index, index * 0.7, 0]}
            >
              <boxGeometry args={[0.008, 0.008, 0.008]} />
              <meshPhysicalMaterial
                clearcoat={0.9}
                color={ORGANIC_COLORS.saltCrystal}
                roughness={0.15}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** Filtration contents: lifted perforated filter basket separating curd above draining brine beaker. */
export function FiltrationContents({
  curdHeight,
  playing,
}: {
  readonly curdHeight: number;
  readonly playing: boolean;
}) {
  const curdGeo = useMemo(
    () => buildCurdDiskGeometry(curdHeight * 0.19),
    [curdHeight]
  );
  const dripsRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  useEffect(() => () => curdGeo.dispose(), [curdGeo]);

  useFrame((_, delta) => {
    const container = dripsRef.current;
    if (!playing || container === null) {
      return;
    }
    phaseRef.current = (phaseRef.current + simulationStep(delta) * 1.3) % 1;
    for (const index of DROP_INDICES) {
      const drip = container.children[index];
      if (drip !== undefined) {
        const u = (phaseRef.current + index / DROP_INDICES.length) % 1;
        if (index < 3) {
          drip.position.set(
            (index - 1) * 0.035,
            0.225 - u * 0.06,
            KETTLE_Z + 0.015
          );
        } else {
          drip.position.set(0.215, 0.115 - u * 0.068, KETTLE_Z + 0.02);
        }
      }
    }
  });

  return (
    <group>
      <group position={[0, 0, KETTLE_Z]}>
        <ColumnLiquid
          bottom={0.118}
          color={ORGANIC_COLORS.waterBlue}
          level={0.165}
          opacity={0.55}
          radius={KETTLE_RADIUS - 0.01}
        />
        <group position={[0, 0.23, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[KETTLE_RADIUS - 0.018, 0.004, 10, 32]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
          </mesh>
          <mesh position={[0, 0.062, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[KETTLE_RADIUS - 0.014, 0.004, 10, 32]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
          </mesh>
          <mesh position={[0, 0.031, 0]}>
            <cylinderGeometry
              args={[
                KETTLE_RADIUS - 0.015,
                KETTLE_RADIUS - 0.018,
                0.062,
                24,
                1,
                true,
              ]}
            />
            <meshStandardMaterial
              color={BENCH_COLORS.probeSteel}
              metalness={0.85}
              opacity={0.42}
              roughness={0.35}
              side={DoubleSide}
              transparent
            />
          </mesh>
          {Arr.map(STRAINER_BARS, (index) => {
            const angle = (index / STRAINER_BARS.length) * Math.PI * 2;
            const r = KETTLE_RADIUS - 0.016;
            return (
              <mesh
                key={index}
                position={[Math.cos(angle) * r, 0.031, Math.sin(angle) * r]}
              >
                <cylinderGeometry args={[0.0022, 0.0022, 0.064, 8]} />
                <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
              </mesh>
            );
          })}
          <mesh
            castShadow
            geometry={curdGeo}
            position={[0, 0.005, 0]}
            scale={[0.92, 1, 0.92]}
          >
            <meshStandardMaterial
              color={ORGANIC_COLORS.soapCream}
              roughness={0.46}
            />
          </mesh>
        </group>
        <mesh position={[0.165, 0.122, 0.02]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.007, 0.007, 0.11, 14]} />
          <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.3} />
        </mesh>
      </group>
      <group ref={dripsRef}>
        {Arr.map(DROP_INDICES, (index) => (
          <mesh
            key={index}
            position={
              index < 3
                ? [(index - 1) * 0.035, 0.21 - index * 0.015, KETTLE_Z + 0.015]
                : [0.215, 0.11 - (index - 3) * 0.02, KETTLE_Z + 0.02]
            }
          >
            <sphereGeometry args={[0.0046, 10, 8]} />
            <meshStandardMaterial
              color={ORGANIC_COLORS.waterBlue}
              emissive={ORGANIC_COLORS.waterBlue}
              emissiveIntensity={0.25}
              opacity={0.82}
              roughness={0.12}
              transparent
            />
          </mesh>
        ))}
      </group>
      <group position={[0.215, 0, KETTLE_Z + 0.02]}>
        <Beaker />
        <ColumnLiquid
          bottom={0.003}
          color={ORGANIC_COLORS.waterBlue}
          level={0.042}
          opacity={0.62}
          radius={0.0235}
        />
      </group>
    </group>
  );
}
