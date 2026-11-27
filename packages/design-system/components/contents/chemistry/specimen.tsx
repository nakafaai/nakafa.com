import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import {
  createBottleLabelTexture,
  drawFormulaText,
  latheProfile,
} from "@repo/design-system/components/contents/chemistry/glassware";
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
  Quaternion,
  Shape,
  SRGBColorSpace,
  Vector3,
} from "three";

const UP_AXIS = new Vector3(0, 1, 0);
const FALLBACK_SIDE = new Vector3(0, 0, 1);

const VIAL_PROFILE = latheProfile([
  [0.001, 0],
  [0.019, 0],
  [0.0215, 0.003],
  [0.0215, 0.058],
  [0.0155, 0.068],
  [0.013, 0.072],
  [0.013, 0.08],
  [0.015, 0.082],
  [0.0128, 0.083],
  [0.0112, 0.08],
  [0.0112, 0.071],
  [0.0194, 0.058],
  [0.0194, 0.004],
  [0.001, 0.0036],
]);

/** Glossy clear-coated molecular or crystal atom sphere. */
export function AtomSphere({
  color,
  emissive,
  emissiveIntensity = 0,
  metalness = 0.06,
  position,
  radius,
  roughness = 0.22,
}: {
  readonly color: string;
  readonly emissive?: string | undefined;
  readonly emissiveIntensity?: number;
  readonly metalness?: number;
  readonly position: readonly [number, number, number];
  readonly radius: number;
  readonly roughness?: number;
}) {
  return (
    <mesh castShadow position={position} receiveShadow>
      <sphereGeometry args={[radius, 28, 20]} />
      <meshPhysicalMaterial
        clearcoat={0.78}
        clearcoatRoughness={0.12}
        color={color}
        emissive={emissive ?? color}
        emissiveIntensity={emissive === undefined ? 0 : emissiveIntensity}
        metalness={metalness}
        roughness={roughness}
      />
    </mesh>
  );
}

/** Machined metallic covalent or electrostatic bond cylinder between two 3D points. */
export function BondCylinder({
  color = BENCH_COLORS.panSteel,
  emissive,
  emissiveIntensity = 0,
  end,
  opacity = 1,
  radius = 0.0036,
  start,
}: {
  readonly color?: string;
  readonly emissive?: string | undefined;
  readonly emissiveIntensity?: number;
  readonly end: readonly [number, number, number];
  readonly opacity?: number;
  readonly radius?: number;
  readonly start: readonly [number, number, number];
}) {
  const { length, mid, quat } = useMemo(() => {
    const a = new Vector3(start[0], start[1], start[2]);
    const b = new Vector3(end[0], end[1], end[2]);
    const dir = new Vector3().subVectors(b, a);
    const len = Math.max(0.0008, dir.length());
    const center = new Vector3().addVectors(a, b).multiplyScalar(0.5);
    const orientation = new Quaternion().setFromUnitVectors(
      UP_AXIS,
      dir.clone().normalize()
    );
    return {
      length: len,
      mid: [center.x, center.y, center.z] as const,
      quat: orientation,
    };
  }, [end, start]);

  return (
    <mesh castShadow position={mid} quaternion={quat}>
      <cylinderGeometry args={[radius, radius, length, 16]} />
      {emissive === undefined && opacity >= 1 ? (
        <MetalMaterial color={color} roughness={0.24} />
      ) : (
        <meshStandardMaterial
          color={color}
          emissive={emissive ?? color}
          emissiveIntensity={emissive === undefined ? 0 : emissiveIntensity}
          metalness={0.55}
          opacity={opacity}
          roughness={0.24}
          transparent={opacity < 1}
        />
      )}
    </mesh>
  );
}

/** Single, double, or triple parallel covalent bond cylinders between two 3D points. */
export function MultiBond({
  color = BENCH_COLORS.panSteel,
  emissive,
  emissiveIntensity = 0,
  end,
  gap = 0.0068,
  order = 1,
  radius = 0.0032,
  start,
}: {
  readonly color?: string;
  readonly emissive?: string | undefined;
  readonly emissiveIntensity?: number;
  readonly end: readonly [number, number, number];
  readonly gap?: number;
  readonly order?: 1 | 2 | 3;
  readonly radius?: number;
  readonly start: readonly [number, number, number];
}) {
  const { length, quat, sticks } = useMemo(() => {
    const a = new Vector3(start[0], start[1], start[2]);
    const b = new Vector3(end[0], end[1], end[2]);
    const dir = new Vector3().subVectors(b, a);
    const len = Math.max(0.0008, dir.length());
    const axis = dir.clone().normalize();
    const orientation = new Quaternion().setFromUnitVectors(UP_AXIS, axis);
    const center = new Vector3().addVectors(a, b).multiplyScalar(0.5);
    const perp = new Vector3().crossVectors(axis, FALLBACK_SIDE);
    if (perp.lengthSq() < 1e-4) {
      perp.crossVectors(axis, UP_AXIS);
    }
    perp.normalize();
    const span = (order - 1) * gap;
    const stickCenters = Arr.map(Arr.range(0, order - 1), (idx) => {
      const offset = order === 1 ? 0 : -span / 2 + idx * gap;
      return {
        key: idx,
        mid: [
          center.x + perp.x * offset,
          center.y + perp.y * offset,
          center.z + perp.z * offset,
        ] as const,
      };
    });
    return { length: len, quat: orientation, sticks: stickCenters };
  }, [end, gap, order, start]);

  const stickRadius = order > 1 ? radius * 0.82 : radius;

  return (
    <group>
      {Arr.map(sticks, (stick) => (
        <mesh castShadow key={stick.key} position={stick.mid} quaternion={quat}>
          <cylinderGeometry args={[stickRadius, stickRadius, length, 16]} />
          {emissive === undefined ? (
            <MetalMaterial color={color} roughness={0.24} />
          ) : (
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
              metalness={0.55}
              roughness={0.24}
            />
          )}
        </mesh>
      ))}
    </group>
  );
}

function createPlaqueTexture(
  formula: string,
  subtitle: string
): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = BENCH_COLORS.balanceBezel;
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = INSTRUMENT_COLORS.brass;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 172);
  ctx.fillStyle = BENCH_COLORS.schellbachWhite;
  const formulaSize = formula.length > 10 ? 44 : 58;
  drawFormulaText(ctx, formula, 256, 92, formulaSize, "center");
  ctx.fillStyle = INSTRUMENT_COLORS.brass;
  ctx.textAlign = "center";
  ctx.font = "600 28px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(subtitle, 256, 150);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Angled brass-bordered specimen nameplate with crisp Unicode chemical formula. */
export function FormulaPlaque({
  formula,
  position,
  subtitle,
  width = 0.132,
}: {
  readonly formula: string;
  readonly position: readonly [number, number, number];
  readonly subtitle: string;
  readonly width?: number;
}) {
  const height = width * 0.375;
  const tex = useMemo(
    () => createPlaqueTexture(formula, subtitle),
    [formula, subtitle]
  );
  useEffect(() => () => tex?.dispose(), [tex]);

  return (
    <group position={position} rotation={[-0.58, 0, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width + 0.008, height + 0.008, 0.006]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
      </mesh>
      {tex === null ? null : (
        <mesh position={[0, 0, 0.0034]}>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial map={tex} roughness={0.42} />
        </mesh>
      )}
    </group>
  );
}

function createRoundedPlinthGeometry(
  width: number,
  depth: number,
  height: number
) {
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.min(0.014, hw * 0.2, hd * 0.2);
  const shape = new Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.0028,
    bevelThickness: 0.0028,
    depth: height,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Bevelled dark anodised display plinth standing on four turned brass feet. */
export function SpecimenPlinth({
  depth = 0.21,
  height = 0.014,
  position = [0, 0, 0],
  width = 0.44,
}: {
  readonly depth?: number;
  readonly height?: number;
  readonly position?: readonly [number, number, number];
  readonly width?: number;
}) {
  const geo = useMemo(
    () => createRoundedPlinthGeometry(width, depth, height),
    [depth, height, width]
  );
  useEffect(() => () => geo.dispose(), [geo]);

  const fx = width / 2 - 0.032;
  const fz = depth / 2 - 0.026;
  const feet = [
    [-fx, -fz],
    [fx, -fz],
    [-fx, fz],
    [fx, fz],
  ] as const;

  return (
    <group position={position}>
      {Arr.map(feet, ([x, z]) => (
        <mesh castShadow key={`${x}-${z}`} position={[x, 0.004, z]}>
          <cylinderGeometry args={[0.011, 0.013, 0.008, 20]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
        </mesh>
      ))}
      <mesh castShadow geometry={geo} position={[0, 0.0108, 0]} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.34}
          clearcoatRoughness={0.32}
          color={CAR_COLORS.dashboard}
          metalness={0.52}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[0, 0.014 + height, depth / 2 - 0.01]}>
        <boxGeometry args={[width - 0.06, 0.002, 0.004]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
      </mesh>
    </group>
  );
}

/** Turned borosilicate sample vial with liquid meniscus, ribbed screw cap, and crisp formula label. */
export function LabeledVial({
  chemicalName,
  concentration,
  fillHeight = 0.045,
  formula,
  liquidColor,
  position,
  stripeColor,
}: {
  readonly chemicalName: string;
  readonly concentration: string;
  readonly fillHeight?: number;
  readonly formula: string;
  readonly liquidColor: string;
  readonly position: readonly [number, number, number];
  readonly stripeColor: string;
}) {
  const labelTex = useMemo(
    () =>
      createBottleLabelTexture(
        formula,
        chemicalName,
        concentration,
        stripeColor
      ),
    [chemicalName, concentration, formula, stripeColor]
  );
  useEffect(() => () => labelTex?.dispose(), [labelTex]);

  return (
    <group position={position}>
      <mesh position={[0, 0.0018, 0]} receiveShadow>
        <cylinderGeometry args={[0.0235, 0.0245, 0.0036, 28]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
      </mesh>
      <ColumnLiquid
        bottom={0.007}
        color={liquidColor}
        level={fillHeight}
        opacity={0.78}
        radius={0.0185}
      />
      <mesh castShadow position={[0, 0.0036, 0]} renderOrder={2}>
        <latheGeometry args={[VIAL_PROFILE, 40]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.28} />
      </mesh>
      {labelTex === null ? null : (
        <mesh position={[0, 0.035, 0]} rotation={[0, -Math.PI * 0.45, 0]}>
          <cylinderGeometry
            args={[0.022, 0.022, 0.028, 28, 1, true, 0, Math.PI * 0.9]}
          />
          <meshStandardMaterial
            map={labelTex}
            polygonOffset
            polygonOffsetFactor={-1}
            roughness={0.84}
          />
        </mesh>
      )}
      <mesh castShadow position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.0145, 0.0145, 0.016, 20]} />
        <meshStandardMaterial color={BENCH_COLORS.bottleCap} roughness={0.52} />
      </mesh>
    </group>
  );
}
