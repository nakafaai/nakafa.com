import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, LatheGeometry, Shape, Vector2 } from "three";

export const CYLINDER_Z = 0.04;
const CYLINDER_OUTER_R = 0.072;
export const CYLINDER_INNER_R = 0.067;
export const CYLINDER_BOTTOM = 0.024;
const CYLINDER_TOP = 0.312;
export const SEPTUM_Y = 0.115;

function toVector2(points: readonly (readonly [number, number])[]) {
  return Arr.map(points, ([r, y]) => new Vector2(r, y));
}

function createBaseFlangeGeometry() {
  return new LatheGeometry(
    toVector2([
      [0.001, 0],
      [0.094, 0],
      [0.096, 0.004],
      [0.096, 0.015],
      [0.084, 0.017],
      [0.082, 0.026],
      [0.074, 0.026],
      [0.074, 0.02],
      [0.001, 0.02],
    ]),
    48
  );
}

function createGlassCylinderGeometry() {
  return new LatheGeometry(
    toVector2([
      [CYLINDER_INNER_R, CYLINDER_BOTTOM],
      [CYLINDER_OUTER_R, CYLINDER_BOTTOM],
      [CYLINDER_OUTER_R, CYLINDER_TOP - 0.006],
      [CYLINDER_OUTER_R + 0.005, CYLINDER_TOP],
      [CYLINDER_INNER_R, CYLINDER_TOP],
      [CYLINDER_INNER_R, CYLINDER_BOTTOM],
    ]),
    56
  );
}

function createPistonHeadGeometry() {
  return new LatheGeometry(
    toVector2([
      [0.001, -0.012],
      [0.062, -0.012],
      [0.065, -0.009],
      [0.065, -0.007],
      [0.061, -0.006],
      [0.061, -0.003],
      [0.065, -0.002],
      [0.065, 0.002],
      [0.061, 0.003],
      [0.061, 0.006],
      [0.065, 0.007],
      [0.065, 0.01],
      [0.06, 0.012],
      [0.001, 0.012],
    ]),
    44
  );
}

function createStandBaseGeometry() {
  const shape = new Shape();
  const w = 0.062;
  const d = 0.1;
  const r = 0.014;
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r);
  shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r);
  shape.quadraticCurveTo(-w, -d, -w + r, -d);
  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    depth: 0.01,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.013, 0);
  return geo;
}

/** Cast-iron retort stand with chrome upright rod and twin bosshead clamps. */
export function RetortStand() {
  const baseGeo = useMemo(createStandBaseGeometry, []);
  useEffect(() => () => baseGeo.dispose(), [baseGeo]);

  const rodX = -0.21;
  const rodZ = -0.04;
  const dx = -rodX;
  const dz = CYLINDER_Z - rodZ;
  const totalDist = Math.hypot(dx, dz);
  const armLen = totalDist - CYLINDER_OUTER_R - 0.005;
  const yaw = Math.atan2(dz, dx);
  const clampHeights = [0.148, 0.282] as const;

  return (
    <group>
      <mesh
        castShadow
        geometry={baseGeo}
        position={[-0.185, 0, 0.01]}
        receiveShadow
      >
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.62} />
      </mesh>
      <mesh castShadow position={[rodX, 0.022, rodZ]}>
        <cylinderGeometry args={[0.013, 0.016, 0.02, 20]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[rodX, 0.225, rodZ]}>
        <cylinderGeometry args={[0.006, 0.006, 0.42, 18]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.2} />
      </mesh>
      {Arr.map(clampHeights, (y) => (
        <group key={y} position={[0, y, 0]}>
          <mesh castShadow position={[rodX, 0, rodZ]}>
            <boxGeometry args={[0.024, 0.022, 0.024]} />
            <MetalMaterial color={CAR_COLORS.castIron} roughness={0.48} />
          </mesh>
          <mesh
            position={[rodX - 0.016, 0, rodZ]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.006, 0.006, 0.012, 14]} />
            <MetalMaterial
              color={PROCESS_COLORS.electronGold}
              roughness={0.3}
            />
          </mesh>
          <mesh
            castShadow
            position={[
              rodX + (dx / totalDist) * (armLen / 2),
              0,
              rodZ + (dz / totalDist) * (armLen / 2),
            ]}
            rotation={[0, -yaw, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.0042, 0.0042, armLen, 14]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0, CYLINDER_Z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[CYLINDER_OUTER_R + 0.003, 0.0038, 12, 40]} />
            <MetalMaterial color={CAR_COLORS.castIron} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0, CYLINDER_Z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[CYLINDER_OUTER_R + 0.0008, 0.002, 10, 40]} />
            <meshStandardMaterial
              color={CAR_COLORS.dashboard}
              roughness={0.85}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Machined base flange, borosilicate cylinder, volumetric ticks, and top collar. */
export function ReactionCylinder() {
  const flangeGeo = useMemo(createBaseFlangeGeometry, []);
  const glassGeo = useMemo(createGlassCylinderGeometry, []);
  useEffect(() => () => flangeGeo.dispose(), [flangeGeo]);
  useEffect(() => () => glassGeo.dispose(), [glassGeo]);

  const bolts = Arr.makeBy(8, (step) => (step / 8) * Math.PI * 2);
  const ticks = Arr.makeBy(10, (step) => ({
    major: step % 2 === 0,
    y: 0.055 + step * 0.024,
  }));

  return (
    <group position={[0, 0, CYLINDER_Z]}>
      <mesh castShadow geometry={flangeGeo} receiveShadow>
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.32} />
      </mesh>
      {Arr.map(bolts, (angle) => (
        <mesh
          castShadow
          key={angle}
          position={[Math.cos(angle) * 0.088, 0.017, Math.sin(angle) * 0.088]}
        >
          <cylinderGeometry args={[0.0042, 0.0042, 0.005, 6]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.26} />
        </mesh>
      ))}
      <mesh geometry={glassGeo}>
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.22} />
      </mesh>
      <mesh position={[0, CYLINDER_TOP, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[CYLINDER_OUTER_R + 0.003, 0.0045, 12, 48]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
      </mesh>
      <mesh position={[0, CYLINDER_TOP + 0.004, 0]}>
        <cylinderGeometry args={[0.014, 0.016, 0.012, 20]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.42} />
      </mesh>
      {Arr.map(ticks, (tick) => (
        <mesh
          key={tick.y}
          position={[
            -0.022,
            tick.y,
            Math.sqrt(CYLINDER_OUTER_R ** 2 - 0.022 ** 2) + 0.0005,
          ]}
          rotation={[0, -0.31, 0]}
        >
          <boxGeometry args={[tick.major ? 0.014 : 0.008, 0.0012, 0.0005]} />
          <meshBasicMaterial color={INSTRUMENT_COLORS.graphite} />
        </mesh>
      ))}
    </group>
  );
}

/** Machined aluminium piston with twin O-rings, chrome rod, and T-handle. */
export function PistonAssembly({ pistonY }: { readonly pistonY: number }) {
  const headGeo = useMemo(createPistonHeadGeometry, []);
  useEffect(() => () => headGeo.dispose(), [headGeo]);

  return (
    <group position={[0, pistonY, CYLINDER_Z]}>
      <mesh castShadow geometry={headGeo}>
        <MetalMaterial
          color={EQUILIBRIUM_COLORS.pistonMetal}
          roughness={0.26}
        />
      </mesh>
      {Arr.map([-0.0045, 0.0045] as const, (dy) => (
        <mesh key={dy} position={[0, dy, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.0645, 0.0026, 10, 44]} />
          <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.82} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.072, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.128, 20]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.18} />
      </mesh>
      <mesh castShadow position={[0, 0.136, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0075, 0.0075, 0.092, 20]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
      </mesh>
      {Arr.map([-0.048, 0.048] as const, (x) => (
        <mesh key={x} position={[x, 0.136, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0095, 0.0095, 0.012, 16]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}
