import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import {
  ALL_FRACTIONS,
  benchTrayY,
  COLUMN_RADIUS,
  fractionHex,
  RIG_Z,
} from "@repo/design-system/components/contents/chemistry/fraction/furnace";
import type { PetroleumFraction } from "@repo/design-system/components/contents/chemistry/fraction/model";
import { evaluatePetroleumFraction } from "@repo/design-system/components/contents/chemistry/fraction/model";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { DoubleSide, LatheGeometry, Vector2 } from "three";

const CAP_POSITIONS = [
  [-0.026, -0.016],
  [0.026, -0.016],
  [0, 0.024],
] as const;

const FOOT_ANGLES = [0, 1, 2, 3] as const;

/** Shared LatheGeometry for one domed stainless bubble cap. */
function buildBubbleCapGeometry(): LatheGeometry {
  const points = Arr.map(
    [
      [0.012, 0],
      [0.012, 0.009],
      [0.011, 0.0125],
      [0.007, 0.015],
      [0.001, 0.016],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(points, 20);
}

/** Shared LatheGeometry for the torispherical steel top head of the column. */
function buildColumnDomeGeometry(): LatheGeometry {
  const points = Arr.map(
    [
      [COLUMN_RADIUS + 0.006, 0],
      [COLUMN_RADIUS + 0.006, 0.008],
      [COLUMN_RADIUS, 0.008],
      [COLUMN_RADIUS * 0.96, 0.022],
      [COLUMN_RADIUS * 0.78, 0.038],
      [COLUMN_RADIUS * 0.45, 0.05],
      [0.014, 0.055],
      [0.014, 0.068],
      [0.02, 0.068],
      [0.02, 0.073],
      [0.001, 0.073],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(points, 36);
}

/** Shared LatheGeometry for the bolted skirt base of the fractionating column. */
function buildColumnSkirtGeometry(): LatheGeometry {
  const points = Arr.map(
    [
      [0.001, 0.012],
      [COLUMN_RADIUS + 0.014, 0.012],
      [COLUMN_RADIUS + 0.014, 0.02],
      [COLUMN_RADIUS + 0.004, 0.024],
      [COLUMN_RADIUS, 0.072],
      [COLUMN_RADIUS + 0.008, 0.072],
      [COLUMN_RADIUS + 0.008, 0.08],
      [0.001, 0.08],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(points, 36);
}

function BubbleCapTray({
  active,
  bubbleCapGeo,
  fraction,
  y,
}: {
  readonly active: boolean;
  readonly bubbleCapGeo: LatheGeometry;
  readonly fraction: PetroleumFraction;
  readonly y: number;
}) {
  const hex = fractionHex(fraction);
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <cylinderGeometry
          args={[COLUMN_RADIUS - 0.005, COLUMN_RADIUS - 0.005, 0.004, 32]}
        />
        <MetalMaterial
          color={active ? BENCH_COLORS.panSteel : BENCH_COLORS.probeSteel}
          roughness={active ? 0.22 : 0.35}
        />
      </mesh>
      <mesh position={[0, 0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[COLUMN_RADIUS - 0.007, 0.0025, 10, 36]} />
        <meshStandardMaterial
          color={active ? hex : BENCH_COLORS.probeSteel}
          emissive={active ? hex : CAR_COLORS.dashboard}
          emissiveIntensity={active ? 0.75 : 0}
          metalness={active ? 0.25 : 0.85}
          roughness={0.3}
        />
      </mesh>
      <ColumnLiquid
        bottom={0.002}
        color={hex}
        level={active ? 0.014 : 0.009}
        opacity={active ? 0.86 : 0.5}
        radius={COLUMN_RADIUS - 0.008}
      />
      {Arr.map(CAP_POSITIONS, ([cx, cz]) => (
        <group key={`${cx}-${cz}`} position={[cx, 0.002, cz]}>
          <mesh position={[0, 0.006, 0]}>
            <cylinderGeometry args={[0.0055, 0.0055, 0.012, 14]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
          </mesh>
          <mesh geometry={bubbleCapGeo} position={[0, 0.004, 0]}>
            <MetalMaterial
              color={active ? BENCH_COLORS.panSteel : CAR_COLORS.castIron}
              roughness={0.26}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[-0.048, -0.022, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.042, 12]} />
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.35} />
      </mesh>
    </group>
  );
}

/**
 * Cutaway steel-and-borosilicate fractionating tower on steel skirt feet,
 * displaying all five bubble-cap trays and pooled hydrocarbon fractions.
 */
export function ColumnTower({
  activeFraction,
}: {
  readonly activeFraction: PetroleumFraction;
}) {
  const domeGeo = useMemo(buildColumnDomeGeometry, []);
  const skirtGeo = useMemo(buildColumnSkirtGeometry, []);
  const capGeo = useMemo(buildBubbleCapGeometry, []);

  useEffect(
    () => () => {
      domeGeo.dispose();
      skirtGeo.dispose();
      capGeo.dispose();
    },
    [capGeo, domeGeo, skirtGeo]
  );

  return (
    <group position={[0, 0, RIG_Z]}>
      {Arr.map(FOOT_ANGLES, (index) => {
        const angle = (index * Math.PI) / 2 + Math.PI / 4;
        return (
          <mesh
            castShadow
            key={index}
            position={[Math.cos(angle) * 0.072, 0.006, Math.sin(angle) * 0.072]}
            receiveShadow
          >
            <cylinderGeometry args={[0.013, 0.016, 0.012, 16]} />
            <MetalMaterial color={CAR_COLORS.rimDark} roughness={0.55} />
          </mesh>
        );
      })}
      <mesh castShadow geometry={skirtGeo} receiveShadow>
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.42} />
      </mesh>
      <mesh castShadow position={[0, 0.28, 0]}>
        <cylinderGeometry
          args={[
            COLUMN_RADIUS + 0.002,
            COLUMN_RADIUS + 0.002,
            0.4,
            32,
            1,
            true,
            Math.PI * 0.58,
            Math.PI * 0.84,
          ]}
        />
        <meshPhysicalMaterial
          color={CAR_COLORS.castIron}
          metalness={0.85}
          roughness={0.36}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry
          args={[COLUMN_RADIUS, COLUMN_RADIUS, 0.4, 40, 1, true]}
        />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.2} />
      </mesh>
      <mesh castShadow geometry={domeGeo} position={[0, 0.48, 0]}>
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.36} />
      </mesh>
      {Arr.map(ALL_FRACTIONS, (id) => {
        const level = evaluatePetroleumFraction(id);
        return (
          <BubbleCapTray
            active={id === activeFraction}
            bubbleCapGeo={capGeo}
            fraction={id}
            key={id}
            y={benchTrayY(level.trayY)}
          />
        );
      })}
    </group>
  );
}
