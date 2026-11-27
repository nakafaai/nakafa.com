import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import {
  DOME_CAP,
  REACTOR_X,
  REACTOR_Z,
} from "@repo/design-system/components/contents/chemistry/economy/geometry";
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
import type { ReactNode } from "react";
import { useMemo } from "react";

const FLANGE_ANGLES = Arr.makeBy(6, (index) => (index / 6) * Math.PI * 2);
const TIE_ROD_ANGLES = Arr.makeBy(
  3,
  (index) => (index / 3) * Math.PI * 2 + 0.52
);

/** The catalytic swirl coil: two and three-fifths turns up the middle of the reactor. */
const COIL: Path = {
  from: [0, 0.088, 0],
  kind: "helix",
  radius: 0.018,
  to: [0, 0.192, 0],
  turns: 2.6,
};

/** Bolted stainless-flanged borosilicate-jacketed catalytic synthesis reactor. */
export function SynthesisReactor({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <group position={[REACTOR_X, 0, REACTOR_Z]}>
      {/* Heavy cast-iron foot ring and 3 tripod legs */}
      <mesh castShadow position={[0, 0.005, 0]} receiveShadow>
        <cylinderGeometry args={[0.056, 0.06, 0.01, 32]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.6} />
      </mesh>
      {Arr.map(TIE_ROD_ANGLES, (angle) => (
        <mesh
          castShadow
          key={`reactor-leg-${angle}`}
          position={[Math.cos(angle) * 0.043, 0.029, Math.sin(angle) * 0.043]}
        >
          <cylinderGeometry args={[0.0045, 0.0055, 0.042, 12]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
        </mesh>
      ))}

      {/* Heavy bolted stainless bottom and top flanges with 6 hex bolts each */}
      {Arr.map([0.056, 0.228] as const, (y) => (
        <group key={`flange-${y}`} position={[0, y, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.056, 0.056, 0.014, 36]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
          </mesh>
          {Arr.map(FLANGE_ANGLES, (angle) => (
            <mesh
              key={`bolt-${y}-${angle}`}
              position={[
                Math.cos(angle) * 0.048,
                0.009,
                Math.sin(angle) * 0.048,
              ]}
            >
              <cylinderGeometry args={[0.0033, 0.0033, 0.007, 6]} />
              <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 3 vertical chrome tie rods */}
      {Arr.map(TIE_ROD_ANGLES, (angle) => (
        <mesh
          castShadow
          key={`tie-rod-${angle}`}
          position={[Math.cos(angle) * 0.051, 0.142, Math.sin(angle) * 0.051]}
        >
          <cylinderGeometry args={[0.0025, 0.0025, 0.172, 10]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.24} />
        </mesh>
      ))}

      {/* Stainless dome cap and top pressure gauge */}
      <mesh castShadow position={[0, 0.235, 0]}>
        <Turn profile={DOME_CAP} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
      </mesh>
      <mesh position={[0, 0.268, 0]}>
        <cylinderGeometry args={[0.0028, 0.0028, 0.014, 12]} />
        <MetalMaterial color={BENCH_COLORS.batteryTerminal} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.281, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0115, 0.0115, 0.0055, 24]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.281, 0.0032]}>
        <circleGeometry args={[0.0092, 24]} />
        <meshStandardMaterial
          color={BENCH_COLORS.schellbachWhite}
          roughness={0.4}
        />
      </mesh>

      {/* Catalytic liquid column and animated swirling core */}
      <ColumnLiquid
        bottom={0.07}
        color={PROCESS_COLORS.catalystTeal}
        level={0.205}
        opacity={0.44}
        radius={0.039}
      />
      {children}

      {/* Thick borosilicate glass reactor jacket */}
      <mesh castShadow position={[0, 0.142, 0]} renderOrder={2}>
        <cylinderGeometry args={[0.044, 0.044, 0.16, 48, 1, true]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.26} />
      </mesh>
    </group>
  );
}

/** Helical catalytic swirl coil and suspended reacting spheres inside the synthesis vessel. */
export function CatalyticSwirl({
  productSpheres,
  wasteSpheres,
}: {
  readonly productSpheres: number;
  readonly wasteSpheres: number;
}) {
  const productDots = useMemo(
    () =>
      Arr.makeBy(productSpheres, (index) => {
        const angle = (index / Math.max(1, productSpheres)) * Math.PI * 2;
        const radius = index % 2 === 0 ? 0.025 : 0.014;
        return {
          id: `core-prod-${index}`,
          x: Math.cos(angle) * radius,
          y: 0.104 + (index / Math.max(1, productSpheres)) * 0.082,
          z: Math.sin(angle) * radius,
        };
      }),
    [productSpheres]
  );

  const wasteDots = useMemo(
    () =>
      Arr.makeBy(wasteSpheres, (index) => {
        const angle =
          (index / Math.max(1, wasteSpheres)) * Math.PI * 2 + Math.PI / 4;
        return {
          id: `core-waste-${index}`,
          x: Math.cos(angle) * 0.022,
          y: 0.088 + index * 0.018,
          z: Math.sin(angle) * 0.022,
        };
      }),
    [wasteSpheres]
  );

  return (
    <group>
      <mesh>
        <Sweep ends="round" path={COIL} radius={0.0022} />
        <meshStandardMaterial
          color={PROCESS_COLORS.catalystTeal}
          emissive={PROCESS_COLORS.catalystTeal}
          emissiveIntensity={0.42}
          metalness={0.55}
          roughness={0.28}
        />
      </mesh>
      {Arr.map(productDots, (dot) => (
        <mesh key={dot.id} position={[dot.x, dot.y, dot.z]}>
          <sphereGeometry args={[0.0052, 12, 10]} />
          <meshStandardMaterial
            color={PROCESS_COLORS.greenProduct}
            emissive={PROCESS_COLORS.greenProduct}
            emissiveIntensity={0.38}
            roughness={0.2}
          />
        </mesh>
      ))}
      {Arr.map(wasteDots, (dot) => (
        <mesh key={dot.id} position={[dot.x, dot.y, dot.z]}>
          <dodecahedronGeometry args={[0.0046, 0]} />
          <meshStandardMaterial
            color={PROCESS_COLORS.wasteSlate}
            roughness={0.78}
          />
        </mesh>
      ))}
    </group>
  );
}
