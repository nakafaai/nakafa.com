import type { AdditionMonomer } from "@repo/design-system/components/contents/chemistry/addition/model";
import {
  ColumnLiquid,
  LabBench,
} from "@repo/design-system/components/contents/chemistry/bench";
import { latheProfile } from "@repo/design-system/components/contents/chemistry/glassware";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Quaternion, Shape, Vector3 } from "three";

export const RIG_Z = 0.04;
export const CHAIN_Y = 0.165;
export const CARBON_DX = 0.029;
export const CARBON_DY = 0.011;
export const MONOMER_BASE_Y = 0.308;

const UP_AXIS = new Vector3(0, 1, 0);

const BASE_FEET = [
  [-0.31, -0.075],
  [0.31, -0.075],
  [-0.31, 0.075],
  [0.31, 0.075],
] as const;

const VIAL_PROFILE = latheProfile([
  [0.001, 0],
  [0.0145, 0],
  [0.0165, 0.003],
  [0.0165, 0.046],
  [0.0115, 0.054],
  [0.0115, 0.064],
  [0.013, 0.066],
  [0.011, 0.067],
  [0.0098, 0.064],
  [0.0098, 0.053],
  [0.0148, 0.046],
  [0.0148, 0.0035],
  [0.001, 0.003],
]);

const METHYL_H_DIRS = [
  [0.013, 0.007, 0.009],
  [-0.013, 0.007, 0.009],
  [0, 0.009, -0.014],
] as const;

function createBaseplateGeometry() {
  const halfW = 0.35;
  const halfD = 0.105;
  const radius = 0.016;
  const outline = new Shape();
  outline.moveTo(-halfW + radius, -halfD);
  outline.lineTo(halfW - radius, -halfD);
  outline.quadraticCurveTo(halfW, -halfD, halfW, -halfD + radius);
  outline.lineTo(halfW, halfD - radius);
  outline.quadraticCurveTo(halfW, halfD, halfW - radius, halfD);
  outline.lineTo(-halfW + radius, halfD);
  outline.quadraticCurveTo(-halfW, halfD, -halfW, halfD - radius);
  outline.lineTo(-halfW, -halfD + radius);
  outline.quadraticCurveTo(-halfW, -halfD, -halfW + radius, -halfD);
  const geo = new ExtrudeGeometry(outline, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    depth: 0.014,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function vialLiquidColor(monomer: AdditionMonomer): string {
  return Match.value(monomer).pipe(
    Match.when("ethene", () => REAGENT_COLORS.solution),
    Match.when("propene", () => REAGENT_COLORS.vinegar),
    Match.when("chloroethene", () => REAGENT_COLORS.ironPaleGreen),
    Match.when("tetrafluoroethene", () => PROCESS_COLORS.boronMint),
    Match.exhaustive
  );
}

/** Machined metallic covalent bond cylinder oriented cleanly between two 3D points. */
export function BondCylinder({
  color = BENCH_COLORS.panSteel,
  emissive,
  emissiveIntensity = 0,
  end,
  radius = 0.0038,
  start,
}: {
  readonly color?: string;
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
  readonly end: readonly [number, number, number];
  readonly radius?: number;
  readonly start: readonly [number, number, number];
}) {
  const { length, mid, quat } = useMemo(() => {
    const a = new Vector3(start[0], start[1], start[2]);
    const b = new Vector3(end[0], end[1], end[2]);
    const dir = new Vector3().subVectors(b, a);
    const len = Math.max(0.001, dir.length());
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
      <cylinderGeometry args={[radius, radius, length, 14]} />
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
  );
}

/** Glossy clear-coated molecular model sphere. */
export function AtomSphere({
  color,
  position,
  radius,
}: {
  readonly color: string;
  readonly position: readonly [number, number, number];
  readonly radius: number;
}) {
  return (
    <mesh castShadow position={position}>
      <sphereGeometry args={[radius, 22, 18]} />
      <meshPhysicalMaterial
        clearcoat={0.75}
        clearcoatRoughness={0.14}
        color={color}
        metalness={0.08}
        roughness={0.24}
      />
    </mesh>
  );
}

/** Substituent bond + atom cluster (H, tetrahedral CH3, Cl, or F). */
export function SubstituentGroup({
  anchor,
  direction,
  kind,
}: {
  readonly anchor: readonly [number, number, number];
  readonly direction: readonly [number, number, number];
  readonly kind: "chlorine" | "fluorine" | "hydrogen" | "methyl";
}) {
  const bondLen = Match.value(kind).pipe(
    Match.when("hydrogen", () => 0.025),
    Match.when("fluorine", () => 0.027),
    Match.when("chlorine", () => 0.032),
    Match.when("methyl", () => 0.031),
    Match.exhaustive
  );

  const tip = useMemo(() => {
    const dir = new Vector3(
      direction[0],
      direction[1],
      direction[2]
    ).normalize();
    return [
      anchor[0] + dir.x * bondLen,
      anchor[1] + dir.y * bondLen,
      anchor[2] + dir.z * bondLen,
    ] as const;
  }, [anchor, bondLen, direction]);

  const atomRadius = Match.value(kind).pipe(
    Match.when("hydrogen", () => 0.0076),
    Match.when("fluorine", () => 0.0102),
    Match.when("chlorine", () => 0.0138),
    Match.when("methyl", () => 0.0112),
    Match.exhaustive
  );

  const atomColor = Match.value(kind).pipe(
    Match.when("hydrogen", () => ORGANIC_COLORS.hydrogenWhite),
    Match.when("fluorine", () => ORGANIC_COLORS.fluorineLime),
    Match.when("chlorine", () => ORGANIC_COLORS.chlorineGreen),
    Match.when("methyl", () => ORGANIC_COLORS.carbonDark),
    Match.exhaustive
  );

  return (
    <group>
      <BondCylinder
        color={
          kind === "methyl" ? INSTRUMENT_COLORS.brass : BENCH_COLORS.panSteel
        }
        end={tip}
        radius={0.0028}
        start={anchor}
      />
      <AtomSphere color={atomColor} position={tip} radius={atomRadius} />
      {kind === "methyl"
        ? Arr.map(METHYL_H_DIRS, (offset) => {
            const hPos = [
              tip[0] + offset[0],
              tip[1] + offset[1],
              tip[2] + offset[2],
            ] as const;
            return (
              <group key={`${offset[0]}-${offset[1]}-${offset[2]}`}>
                <BondCylinder end={hPos} radius={0.0021} start={tip} />
                <AtomSphere
                  color={ORGANIC_COLORS.hydrogenWhite}
                  position={hPos}
                  radius={0.0064}
                />
              </group>
            );
          })
        : null}
    </group>
  );
}

/** Dark anodised display plinth on brass feet, sliding chrome stanchions, and reagent vial. */
export function PolymerDisplayBase({
  monomer,
  stanchionX,
}: {
  readonly monomer: AdditionMonomer;
  readonly stanchionX: number;
}) {
  const baseGeo = useMemo(createBaseplateGeometry, []);
  useEffect(() => () => baseGeo.dispose(), [baseGeo]);

  return (
    <group>
      <LabBench width={2.6} />
      <group position={[0, 0, RIG_Z]}>
        {/* Turned brass feet */}
        {Arr.map(BASE_FEET, ([x, z]) => (
          <mesh castShadow key={`${x}-${z}`} position={[x, 0.004, z]}>
            <cylinderGeometry args={[0.012, 0.014, 0.008, 20]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
          </mesh>
        ))}
        {/* Bevelled dark anodised aluminium plinth */}
        <mesh
          castShadow
          geometry={baseGeo}
          position={[0, 0.011, 0]}
          receiveShadow
        >
          <meshPhysicalMaterial
            clearcoat={0.35}
            clearcoatRoughness={0.34}
            color={CAR_COLORS.dashboard}
            metalness={0.55}
            roughness={0.38}
          />
        </mesh>
        {/* Front brass inlay trim */}
        <mesh position={[0, 0.0285, 0.095]}>
          <boxGeometry args={[0.64, 0.002, 0.004]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
        </mesh>
        {/* Twin recessed slide rails for adjustable chain stanchions */}
        {Arr.map([-0.014, 0.014] as const, (z) => (
          <mesh key={z} position={[0, 0.0285, z]}>
            <boxGeometry args={[0.56, 0.0024, 0.005]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
          </mesh>
        ))}
        {/* Left and right vertical brushed-chrome mounting stanchions */}
        {Arr.map([-stanchionX, stanchionX] as const, (x) => (
          <group key={x} position={[x, 0.028, 0]}>
            <mesh castShadow position={[0, 0.008, 0]}>
              <cylinderGeometry args={[0.015, 0.017, 0.016, 24]} />
              <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
            </mesh>
            <mesh castShadow position={[0, 0.072, 0]}>
              <cylinderGeometry args={[0.0058, 0.0062, 0.128, 20]} />
              <MetalMaterial color={CAR_COLORS.chrome} roughness={0.2} />
            </mesh>
            <mesh castShadow position={[0, CHAIN_Y - 0.028, 0]}>
              <cylinderGeometry args={[0.0105, 0.0105, 0.022, 20]} />
              <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
            </mesh>
          </group>
        ))}
        {/* Miniature turned borosilicate reagent sample vial on right plinth corner */}
        <group position={[0.312, 0.028, 0.056]}>
          <mesh position={[0, 0.0015, 0]}>
            <cylinderGeometry args={[0.0185, 0.0195, 0.003, 24]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
          </mesh>
          <ColumnLiquid
            bottom={0.006}
            color={vialLiquidColor(monomer)}
            level={0.036}
            opacity={0.72}
            radius={0.014}
          />
          <mesh castShadow position={[0, 0.003, 0]} renderOrder={2}>
            <latheGeometry args={[VIAL_PROFILE, 36]} />
            <GlassMaterial color={BENCH_COLORS.glass} opacity={0.32} />
          </mesh>
          <mesh position={[0, 0.025, 0]} rotation={[0, -Math.PI * 0.45, 0]}>
            <cylinderGeometry
              args={[0.017, 0.017, 0.02, 20, 1, true, 0, Math.PI * 0.9]}
            />
            <meshStandardMaterial
              color={BENCH_COLORS.bottleLabelPaper}
              roughness={0.85}
            />
          </mesh>
          <mesh castShadow position={[0, 0.073, 0]}>
            <cylinderGeometry args={[0.0125, 0.0125, 0.013, 20]} />
            <meshStandardMaterial
              color={BENCH_COLORS.bottleCap}
              roughness={0.5}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
