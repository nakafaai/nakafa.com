import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import {
  DOME_CAP,
  FEED,
  REACTOR_X,
  REACTOR_Z,
} from "@repo/design-system/components/contents/chemistry/recovery/geometry";
import type { CatalysisMode } from "@repo/design-system/components/contents/chemistry/recovery/model";
import { Sweep, Turn } from "@repo/design-system/components/three/form/part";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Match } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

const FLANGE_ANGLES = Arr.makeBy(6, (i) => (i / 6) * Math.PI * 2);
const TIE_ROD_ANGLES = Arr.makeBy(3, (i) => (i / 3) * Math.PI * 2 + 0.5);

/** Stainless reactant feed reservoir, flanged feed tube, and brass gate valve. */
export function FeedManifold() {
  return (
    <group>
      {/* Stainless feed vessel */}
      <group position={[-0.23, 0, 0.02]}>
        <mesh castShadow position={[0, 0.005, 0]} receiveShadow>
          <cylinderGeometry args={[0.042, 0.044, 0.01, 32]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.55} />
        </mesh>
        <mesh castShadow position={[0, 0.078, 0]} receiveShadow>
          <cylinderGeometry args={[0.036, 0.036, 0.136, 36]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
        </mesh>
        <mesh castShadow position={[0, 0.146, 0]}>
          <Turn profile={DOME_CAP} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.24} />
        </mesh>
        {/* Front sight-glass showing blue reactant fill */}
        <mesh position={[0, 0.082, 0.0362]}>
          <boxGeometry args={[0.012, 0.09, 0.002]} />
          <meshPhysicalMaterial
            clearcoat={0.8}
            color={PROCESS_COLORS.ammoniaCyan}
            roughness={0.18}
          />
        </mesh>
        {/* Pressure gauge dial */}
        <mesh position={[0, 0.184, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.016, 12]} />
          <MetalMaterial
            color={BENCH_COLORS.batteryTerminal}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 0.197, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.006, 24]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.197, 0.0035]}>
          <circleGeometry args={[0.0095, 24]} />
          <meshStandardMaterial
            color={BENCH_COLORS.schellbachWhite}
            roughness={0.4}
          />
        </mesh>
      </group>

      {/* Curved stainless feed pipe */}
      <mesh castShadow>
        <Sweep path={FEED} radius={0.0055} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
      </mesh>
      {/* Brass gate valve wheel */}
      <group position={[-0.125, 0.104, 0.02]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.01, 0.01, 0.016, 18]} />
          <MetalMaterial
            color={BENCH_COLORS.batteryTerminal}
            roughness={0.34}
          />
        </mesh>
        <mesh position={[0, 0.016, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.018, 12]} />
          <MetalMaterial
            color={BENCH_COLORS.batteryTerminal}
            roughness={0.34}
          />
        </mesh>
        <mesh position={[0, 0.026, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.014, 0.0024, 10, 24]} />
          <MetalMaterial color={PROCESS_COLORS.alloyBronze} roughness={0.38} />
        </mesh>
        <mesh position={[0, 0.026, 0]}>
          <boxGeometry args={[0.026, 0.0022, 0.0022]} />
          <MetalMaterial color={PROCESS_COLORS.alloyBronze} roughness={0.38} />
        </mesh>
      </group>
    </group>
  );
}

/** Packed-bed internal media tailored to each catalysis mode. */
export function ReactorMedia({ mode }: { readonly mode: CatalysisMode }) {
  const items = useMemo(
    () =>
      Arr.makeBy(26, (index) => {
        const layer = Math.floor(index / 6);
        const slot = index % 6;
        const angle = (slot / 6) * Math.PI * 2 + layer * 0.55;
        const ring = slot % 2 === 0 ? 0.024 : 0.012;
        return {
          id: `media-${index}`,
          x: Math.cos(angle) * ring,
          y: 0.088 + layer * 0.024 + (slot % 3) * 0.004,
          z: Math.sin(angle) * ring,
        };
      }),
    []
  );

  return Match.value(mode).pipe(
    Match.when("stoichiometric", () => (
      <group>
        <ColumnLiquid
          bottom={0.078}
          color={PROCESS_COLORS.wasteSlate}
          level={0.186}
          opacity={0.86}
          radius={0.038}
        />
        {Arr.map(items, (item) => (
          <mesh key={item.id} position={[item.x, item.y, item.z]}>
            <dodecahedronGeometry args={[0.0052, 0]} />
            <meshStandardMaterial color={CAR_COLORS.hub} roughness={0.82} />
          </mesh>
        ))}
      </group>
    )),
    Match.when("homogeneous", () => (
      <group>
        <ColumnLiquid
          bottom={0.078}
          color={PROCESS_COLORS.oleumAmber}
          level={0.194}
          opacity={0.54}
          radius={0.038}
        />
        {Arr.map(items, (item) => (
          <mesh key={item.id} position={[item.x, item.y, item.z]}>
            <sphereGeometry args={[0.0032, 10, 10]} />
            <meshPhysicalMaterial
              clearcoat={0.8}
              color={PROCESS_COLORS.electronGold}
              roughness={0.2}
            />
          </mesh>
        ))}
      </group>
    )),
    Match.when("heterogeneous", () => (
      <group>
        <ColumnLiquid
          bottom={0.078}
          color={BENCH_COLORS.glass}
          level={0.196}
          opacity={0.28}
          radius={0.0385}
        />
        {Arr.map(items, (item) => (
          <mesh
            castShadow
            key={item.id}
            position={[item.x, item.y, item.z]}
            rotation={[item.x * 22, item.y * 18, item.z * 25]}
          >
            <cylinderGeometry args={[0.0058, 0.0058, 0.011, 12]} />
            <meshStandardMaterial
              color={PROCESS_COLORS.catalystTeal}
              metalness={0.45}
              roughness={0.48}
            />
          </mesh>
        ))}
      </group>
    )),
    Match.when("biocatalyst", () => (
      <group>
        <ColumnLiquid
          bottom={0.078}
          color={BENCH_COLORS.glass}
          level={0.196}
          opacity={0.3}
          radius={0.0385}
        />
        {Arr.map(items, (item) => (
          <mesh key={item.id} position={[item.x, item.y, item.z]}>
            <sphereGeometry args={[0.0066, 14, 12]} />
            <meshPhysicalMaterial
              clearcoat={1}
              color={PROCESS_COLORS.boronMint}
              opacity={0.86}
              roughness={0.12}
              transparent
            />
          </mesh>
        ))}
      </group>
    )),
    Match.exhaustive
  );
}

/** Flanged stainless and borosilicate packed catalyst bed reactor on a tripod stand. */
export function PackedReactor({ children }: { readonly children: ReactNode }) {
  return (
    <group position={[REACTOR_X, 0, REACTOR_Z]}>
      {/* Cast-iron base ring and tripod legs */}
      <mesh castShadow position={[0, 0.005, 0]} receiveShadow>
        <cylinderGeometry args={[0.056, 0.06, 0.01, 32]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.6} />
      </mesh>
      {Arr.map(TIE_ROD_ANGLES, (angle) => (
        <mesh
          castShadow
          key={`leg-${angle}`}
          position={[Math.cos(angle) * 0.042, 0.029, Math.sin(angle) * 0.042]}
        >
          <cylinderGeometry args={[0.0045, 0.0055, 0.042, 12]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
        </mesh>
      ))}
      {/* Bottom and top bolted stainless flanges */}
      {Arr.map([0.055, 0.225] as const, (y) => (
        <group key={`flange-${y}`} position={[0, y, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.055, 0.055, 0.014, 36]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.32} />
          </mesh>
          {Arr.map(FLANGE_ANGLES, (angle) => (
            <mesh
              key={`bolt-${y}-${angle}`}
              position={[
                Math.cos(angle) * 0.047,
                0.009,
                Math.sin(angle) * 0.047,
              ]}
            >
              <cylinderGeometry args={[0.0032, 0.0032, 0.007, 6]} />
              <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Vertical stainless tie rods */}
      {Arr.map(TIE_ROD_ANGLES, (angle) => (
        <mesh
          castShadow
          key={`rod-${angle}`}
          position={[Math.cos(angle) * 0.05, 0.14, Math.sin(angle) * 0.05]}
        >
          <cylinderGeometry args={[0.0024, 0.0024, 0.17, 10]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
        </mesh>
      ))}
      {/* Perforated retainer screens */}
      {Arr.map([0.076, 0.2] as const, (y) => (
        <mesh key={`screen-${y}`} position={[0, y, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.0035, 28]} />
          <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.38} />
        </mesh>
      ))}
      {/* Mode-specific catalyst or reagent contents */}
      {children}
      {/* Borosilicate reactor column wall */}
      <mesh castShadow position={[0, 0.14, 0]} renderOrder={2}>
        <cylinderGeometry args={[0.043, 0.043, 0.158, 44, 1, true]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.26} />
      </mesh>
    </group>
  );
}
