import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { latheProfile } from "@repo/design-system/components/contents/chemistry/glassware";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  SRGBColorSpace,
} from "three";

export const RIG_Z = 0.04;
export const CYL_FLOOR = 0.04;
export const CYL_INNER_R = 0.064;
const CYL_TOP = 0.308;
const CYL_OUTER_R = 0.069;

const FLANGE_PROFILE = latheProfile([
  [0.001, 0],
  [0.088, 0],
  [0.088, 0.012],
  [0.076, 0.014],
  [0.076, 0.024],
  [0.064, 0.024],
  [0.064, 0.018],
  [0.001, 0.018],
]);

const PISTON_PROFILE = latheProfile([
  [0.001, -0.012],
  [0.059, -0.012],
  [0.0615, -0.01],
  [0.0615, 0.01],
  [0.059, 0.012],
  [0.014, 0.012],
  [0.012, 0.018],
  [0.001, 0.018],
]);

const FLANGE_BOLTS = Arr.makeBy(6, (idx) => (idx / 6) * Math.PI * 2);
const CLAMP_HEIGHTS = [0.135, 0.278] as const;
const GRAD_TICKS = Arr.makeBy(7, (idx) => 0.07 + idx * 0.036);

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

function createVolumeScaleTexture(): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.clearRect(0, 0, 512, 512);
  ctx.shadowColor = BENCH_COLORS.glassMarkingShadow;
  ctx.shadowBlur = 2;
  ctx.strokeStyle = BENCH_COLORS.glassMarking;
  ctx.fillStyle = BENCH_COLORS.glassMarking;
  ctx.lineWidth = 4;
  ctx.font = "700 22px ui-sans-serif, system-ui, sans-serif";
  const marks = [
    { label: "70", y: 66 },
    { label: "60", y: 122 },
    { label: "50", y: 178 },
    { label: "40", y: 234 },
    { label: "30", y: 290 },
    { label: "20", y: 346 },
    { label: "10", y: 402 },
  ] as const;
  Arr.forEach(marks, (mark) => {
    ctx.beginPath();
    ctx.moveTo(126, mark.y);
    ctx.lineTo(176, mark.y);
    ctx.stroke();
    ctx.fillText(mark.label, 184, mark.y + 8);
  });
  ctx.font = "700 18px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("dm3", 128, 34);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
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
  const flangeGeo = useMemo(() => new LatheGeometry(FLANGE_PROFILE, 44), []);
  const scaleTex = useMemo(createVolumeScaleTexture, []);
  useEffect(() => () => flangeGeo.dispose(), [flangeGeo]);
  useEffect(() => () => scaleTex?.dispose(), [scaleTex]);

  const height = CYL_TOP - CYL_FLOOR;

  return (
    <group position={[0, 0, RIG_Z]}>
      {/* Bolted stainless steel base flange */}
      <mesh
        castShadow
        geometry={flangeGeo}
        position={[0, 0.017, 0]}
        receiveShadow
      >
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
      {/* Silk-screened white dm3 volumetric graduation markings */}
      {scaleTex === null ? null : (
        <mesh
          position={[0, CYL_FLOOR + height / 2, 0]}
          renderOrder={3}
          rotation={[0, -Math.PI * 0.88, 0]}
        >
          <cylinderGeometry
            args={[
              CYL_OUTER_R + 0.0008,
              CYL_OUTER_R + 0.0008,
              height - 0.015,
              44,
              1,
              true,
            ]}
          />
          <meshBasicMaterial
            depthWrite={false}
            map={scaleTex}
            opacity={0.94}
            transparent
          />
        </mesh>
      )}
      {/* 3D crisp white scale bar and tick markers on left front */}
      <mesh position={[-CYL_OUTER_R - 0.001, CYL_FLOOR + height / 2, 0.014]}>
        <boxGeometry args={[0.0018, height - 0.032, 0.0018]} />
        <meshStandardMaterial
          color={BENCH_COLORS.schellbachWhite}
          roughness={0.4}
        />
      </mesh>
      {Arr.map(GRAD_TICKS, (y) => (
        <mesh key={y} position={[-CYL_OUTER_R - 0.001, y, 0.022]}>
          <boxGeometry args={[0.002, 0.0022, 0.014]} />
          <meshStandardMaterial
            color={BENCH_COLORS.schellbachWhite}
            roughness={0.4}
          />
        </mesh>
      ))}
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
  const headGeo = useMemo(() => new LatheGeometry(PISTON_PROFILE, 44), []);
  useEffect(() => () => headGeo.dispose(), [headGeo]);

  const rodLen = 0.125;

  return (
    <group position={[0, pistonY, RIG_Z]}>
      <mesh castShadow geometry={headGeo}>
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
