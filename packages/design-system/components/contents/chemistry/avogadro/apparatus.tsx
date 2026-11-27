import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { Turn } from "@repo/design-system/components/three/form/part";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { graduationSheet } from "@repo/design-system/components/three/print/graduation";
import { PrintSleeve } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

export const RIG_Z = 0.04;
export const CYL_FLOOR = 0.04;
export const CYL_INNER_R = 0.064;
const CYL_TOP = 0.308;
const CYL_OUTER_R = 0.069;

const FLANGE_PROFILE = [
  [0, 0],
  [0.088, 0],
  [0.088, 0.012],
  [0.076, 0.014],
  [0.076, 0.024],
  [0.064, 0.024],
  [0.064, 0.018],
  [0, 0.018],
] as const;

const PISTON_PROFILE = [
  [0, -0.012],
  [0.059, -0.012],
  [0.0615, -0.01],
  [0.0615, 0.01],
  [0.059, 0.012],
  [0.014, 0.012],
  [0.012, 0.018],
  [0, 0.018],
] as const;

const FLANGE_BOLTS = Arr.makeBy(6, (idx) => (idx / 6) * Math.PI * 2);
const CLAMP_HEIGHTS = [0.135, 0.278] as const;

/**
 * How the cylinder reads its gas: the scene lifts the piston 0.215 m for
 * every 75 dm³ from a middle height of 0.068 m, and the gas ends at the
 * piston's lower face, 0.012 m below its middle. The scale is fired where
 * that face stands at each volume, so the piston reads the volume the lab
 * states.
 */
const VOLUME = {
  rise: 0.215 / 75,
  scale: { from: 10, major: 10, minor: 5, to: 70 },
  zero: 0.068 - 0.012,
} as const;

function createStandBaseGeometry() {
  const halfW = 0.195;
  const halfD = 0.105;
  const r = 0.012;
  const shape = new Shape();
  shape.moveTo(-halfW + r, -halfD);
  shape.lineTo(halfW - r, -halfD);
  shape.quadraticCurveTo(halfW, -halfD, halfW, -halfD + r);
  shape.lineTo(halfW, halfD - r);
  shape.quadraticCurveTo(halfW, halfD, halfW - r, halfD);
  shape.lineTo(-halfW + r, halfD);
  shape.quadraticCurveTo(-halfW, halfD, -halfW, halfD - r);
  shape.lineTo(-halfW, -halfD + r);
  shape.quadraticCurveTo(-halfW, -halfD, -halfW + r, -halfD);
  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.0025,
    bevelThickness: 0.0025,
    depth: 0.014,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Cast-iron retort stand, vertical chrome rod, and twin bosshead clamps. */
export function RetortStand() {
  const baseGeo = useMemo(createStandBaseGeometry, []);
  useEffect(() => () => baseGeo.dispose(), [baseGeo]);

  return (
    <group>
      <LabBench width={2.6} />
      <group position={[0, 0, RIG_Z]}>
        {/* Cast-iron bevelled base */}
        <mesh
          castShadow
          geometry={baseGeo}
          position={[-0.01, 0.0025, 0]}
          receiveShadow
        >
          <MetalMaterial color={CAR_COLORS.rimDark} roughness={0.62} />
        </mesh>
        {/* Left main chrome retort rod */}
        <mesh castShadow position={[-0.155, 0.218, -0.028]}>
          <cylinderGeometry args={[0.0062, 0.0062, 0.405, 20]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.2} />
        </mesh>
        <mesh position={[-0.155, 0.022, -0.028]}>
          <cylinderGeometry args={[0.013, 0.014, 0.012, 20]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
        </mesh>
        {/* Twin bosshead clamps gripping gas cylinder */}
        {Arr.map(CLAMP_HEIGHTS, (y) => (
          <group key={y} position={[0, y, 0]}>
            <mesh castShadow position={[-0.155, 0, -0.028]}>
              <boxGeometry args={[0.024, 0.024, 0.028]} />
              <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
            </mesh>
            <mesh position={[-0.172, 0, -0.028]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.004, 0.004, 0.014, 12]} />
              <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
            </mesh>
            <group position={[-0.112, 0, -0.015]} rotation={[0, -0.26, 0]}>
              <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.004, 0.004, 0.09, 14]} />
                <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
              </mesh>
            </group>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[CYL_OUTER_R + 0.003, 0.0042, 10, 44]} />
              <MetalMaterial color={CAR_COLORS.castIron} roughness={0.44} />
            </mesh>
          </group>
        ))}
        {/* Right thermometer support post & clamp arm */}
        <mesh castShadow position={[0.168, 0.142, -0.042]}>
          <cylinderGeometry args={[0.0045, 0.0045, 0.252, 16]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
        </mesh>
        <mesh castShadow position={[0.168, 0.205, -0.042]}>
          <boxGeometry args={[0.018, 0.018, 0.02]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
        </mesh>
        <group position={[0.1565, 0.205, -0.017]} rotation={[0, -0.43, 0]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.003, 0.003, 0.056, 12]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Bolted stainless base flange and graduated borosilicate gas cylinder. */
export function GasCylinder() {
  const format = usePrintNumber();
  const scale = useMemo(
    () =>
      graduationSheet(
        {
          caption: "dm³",
          ink: BENCH_COLORS.schellbachBlue,
          rise: VOLUME.rise,
          scale: VOLUME.scale,
          size: 0.0105,
        },
        format
      ),
    [format]
  );

  const height = CYL_TOP - CYL_FLOOR;

  return (
    <group position={[0, 0, RIG_Z]}>
      {/* Bolted stainless steel base flange */}
      <mesh castShadow position={[0, 0.017, 0]} receiveShadow>
        <Turn profile={FLANGE_PROFILE} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
      </mesh>
      {Arr.map(FLANGE_BOLTS, (ang) => (
        <mesh
          key={ang}
          position={[Math.cos(ang) * 0.081, 0.032, Math.sin(ang) * 0.081]}
        >
          <cylinderGeometry args={[0.0042, 0.0042, 0.006, 6]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
        </mesh>
      ))}
      {/* Inner rubber base seal */}
      <mesh position={[0, CYL_FLOOR - 0.001, 0]}>
        <cylinderGeometry
          args={[CYL_INNER_R - 0.001, CYL_INNER_R - 0.001, 0.004, 36]}
        />
        <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.82} />
      </mesh>
      {/* Heavy-walled borosilicate glass barrel */}
      <mesh position={[0, CYL_FLOOR + height / 2, 0]} renderOrder={2}>
        <cylinderGeometry
          args={[CYL_OUTER_R, CYL_OUTER_R, height, 48, 1, true]}
        />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.25} />
      </mesh>
      <mesh position={[0, CYL_FLOOR + height / 2, 0]} renderOrder={2}>
        <cylinderGeometry
          args={[CYL_INNER_R, CYL_INNER_R, height, 44, 1, true]}
        />
        <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.14} />
      </mesh>
      {/* Fired blue enamel dm³ scale, each mark where the piston's lower face stands at that volume */}
      <group
        position={[
          0,
          VOLUME.zero +
            ((VOLUME.scale.from + VOLUME.scale.to) / 2) * VOLUME.rise,
          0,
        ]}
        rotation={[0, -0.55, 0]}
      >
        <PrintSleeve radius={CYL_OUTER_R} sheet={scale} stock="enamel" />
      </group>
      {/* Top machined stainless guide collar & piston-rod bushing */}
      <mesh position={[0, CYL_TOP + 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[CYL_OUTER_R, 0.006, 12, 48]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
      </mesh>
      <mesh position={[0, CYL_TOP + 0.012, 0]}>
        <boxGeometry args={[CYL_OUTER_R * 2 + 0.008, 0.006, 0.016]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
      </mesh>
      <mesh position={[0, CYL_TOP + 0.018, 0]}>
        <cylinderGeometry args={[0.012, 0.013, 0.014, 24]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
      </mesh>
    </group>
  );
}

/** Turned aluminium moving piston head with twin black rubber O-rings, chrome push-rod, and T-handle. */
export function PistonAssembly({ pistonY }: { readonly pistonY: number }) {
  const rodLen = 0.125;

  return (
    <group position={[0, pistonY, RIG_Z]}>
      <mesh castShadow>
        <Turn profile={PISTON_PROFILE} />
        <MetalMaterial color={INSTRUMENT_COLORS.aluminium} roughness={0.24} />
      </mesh>
      {/* Twin black rubber O-ring seals */}
      {Arr.map([-0.0055, 0.0055] as const, (dy) => (
        <mesh key={dy} position={[0, dy, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.0612, 0.0024, 10, 44]} />
          <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.82} />
        </mesh>
      ))}
      {/* Polished chrome push-rod */}
      <mesh castShadow position={[0, 0.015 + rodLen / 2, 0]}>
        <cylinderGeometry args={[0.0062, 0.0062, rodLen, 20]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.16} />
      </mesh>
      {/* Horizontal T-handle */}
      <mesh
        castShadow
        position={[0, 0.015 + rodLen, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0072, 0.0072, 0.078, 20]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.2} />
      </mesh>
      {Arr.map([-0.027, 0.027] as const, (dx) => (
        <mesh
          castShadow
          key={dx}
          position={[dx, 0.015 + rodLen, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.0088, 0.0088, 0.028, 18]} />
          <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.74} />
        </mesh>
      ))}
    </group>
  );
}
