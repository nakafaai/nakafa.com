import type { Monomer } from "@repo/design-system/components/contents/biology/sugar/polymer";
import { ATOM_COLORS } from "@repo/design-system/lib/material/atom";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Match } from "effect";
import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";

const UP = new Vector3(0, 1, 0);

/** Reusable 3D covalent bond rod connecting any two atomic coordinates. */
export function CovalentBond({
  color = ATOM_COLORS.cpkSilver,
  from,
  radius = 0.014,
  to,
}: {
  readonly color?: string;
  readonly from: readonly [number, number, number];
  readonly radius?: number;
  readonly to: readonly [number, number, number];
}) {
  const { len, mid, quat } = useMemo(() => {
    const a = new Vector3(from[0], from[1], from[2]);
    const b = new Vector3(to[0], to[1], to[2]);
    const dir = b.clone().sub(a);
    return {
      len: Math.max(0.005, dir.length()),
      mid: a.clone().add(b).multiplyScalar(0.5),
      quat: new Quaternion().setFromUnitVectors(UP, dir.normalize()),
    };
  }, [from, to]);

  return (
    <mesh castShadow position={[mid.x, mid.y, mid.z]} quaternion={quat}>
      <cylinderGeometry args={[radius, radius, len, 10]} />
      <meshPhysicalMaterial
        clearcoat={0.4}
        color={color}
        metalness={0.18}
        roughness={0.34}
      />
    </mesh>
  );
}

/**
 * 3D CPK ball-and-stick chair pyranose (glucose/galactose) or envelope furanose
 * (fructose) monosaccharide ring with exocyclic CH2OH & hydroxyl oxygens.
 */
export function MonosaccharideMolecule({
  compact = false,
  monomer,
  position,
  tintColor,
}: {
  readonly compact?: boolean;
  readonly monomer: Monomer;
  readonly position: readonly [number, number, number];
  readonly tintColor?: string;
}) {
  const sides = monomer === "fructose" ? 5 : 6;
  const ringRadius = compact ? 0.085 : 0.19;
  const atomR = compact ? 0.022 : 0.044;
  const accent =
    tintColor ??
    Match.value(monomer).pipe(
      Match.when("glucose", () => BIOLOGY_COLORS.glucose),
      Match.when("fructose", () => PLOT_COLORS.amber),
      Match.when("galactose", () => PLOT_COLORS.violet),
      Match.exhaustive
    );

  // Puckered 3D chair / envelope ring vertices (index 0 is ring oxygen O5/O2).
  const vertices = useMemo(
    () =>
      Arr.makeBy(sides, (i) => {
        const theta = (i / sides) * Math.PI * 2 + Math.PI / 6;
        const puckerZ = (i % 2 === 0 ? 1 : -1) * ringRadius * 0.18;
        return {
          id: `v-${i}`,
          isOxygen: i === 0,
          pos: [
            Math.cos(theta) * ringRadius,
            Math.sin(theta) * ringRadius,
            puckerZ,
          ] as const,
        };
      }),
    [ringRadius, sides]
  );

  const bonds = useMemo(
    () =>
      Arr.makeBy(sides, (i) => ({
        from: vertices[i].pos,
        id: `b-${i}`,
        to: vertices[(i + 1) % sides].pos,
      })),
    [sides, vertices]
  );

  // Exocyclic hydroxyl oxygens (-OH) around carbons on full-scale disaccharide view.
  const hydroxyls = useMemo(
    () =>
      compact
        ? []
        : Arr.map(
            Arr.filter(vertices, (v) => !v.isOxygen),
            (v) => {
              const outX = v.pos[0] * 1.48;
              const outY = v.pos[1] * 1.48;
              const outZ = v.pos[2] * 1.35;
              return {
                base: v.pos,
                id: `oh-${v.id}`,
                pos: [outX, outY, outZ] as const,
              };
            }
          ),
    [compact, vertices]
  );

  return (
    <group position={position}>
      {/* Translucent colored molecular ring plane highlight for rapid sugar identification */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry
          args={[ringRadius * 0.9, ringRadius * 0.9, 0.012, sides]}
        />
        <meshPhysicalMaterial
          clearcoat={0.7}
          color={accent}
          depthWrite={false}
          opacity={compact ? 0.42 : 0.24}
          roughness={0.22}
          transparent
        />
      </mesh>

      {/* Ring covalent bonds */}
      {Arr.map(bonds, (bond) => (
        <CovalentBond
          from={bond.from}
          key={bond.id}
          radius={compact ? 0.008 : 0.016}
          to={bond.to}
        />
      ))}

      {/* Ring carbon & oxygen CPK spheres */}
      {Arr.map(vertices, (v) => (
        <mesh castShadow key={v.id} position={v.pos}>
          <sphereGeometry args={[atomR, 18, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.72}
            clearcoatRoughness={0.18}
            color={v.isOxygen ? ATOM_COLORS.cpkOxygen : ATOM_COLORS.cpkCarbon}
            roughness={0.26}
          />
        </mesh>
      ))}

      {/* Exocyclic hydroxyl substituents on disaccharide scale */}
      {Arr.map(hydroxyls, (oh) => (
        <group key={oh.id}>
          <CovalentBond from={oh.base} radius={0.011} to={oh.pos} />
          <mesh castShadow position={oh.pos}>
            <sphereGeometry args={[0.032, 14, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.7}
              color={ATOM_COLORS.cpkOxygen}
              roughness={0.24}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Realistic 3D bent H2O water molecule (104.5 degree H-O-H bond geometry). */
export function WaterMolecule({
  position,
}: {
  readonly position: readonly [number, number, number];
}) {
  const hLeft: readonly [number, number, number] = [-0.068, -0.048, 0];
  const hRight: readonly [number, number, number] = [0.068, -0.048, 0];
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[0.052, 20, 18]} />
        <meshPhysicalMaterial
          clearcoat={0.8}
          color={ATOM_COLORS.cpkOxygen}
          roughness={0.2}
        />
      </mesh>
      <CovalentBond from={[0, 0, 0]} radius={0.013} to={hLeft} />
      <CovalentBond from={[0, 0, 0]} radius={0.013} to={hRight} />
      <mesh castShadow position={hLeft}>
        <sphereGeometry args={[0.034, 16, 14]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          color={ATOM_COLORS.cpkHydrogen}
          roughness={0.22}
        />
      </mesh>
      <mesh castShadow position={hRight}>
        <sphereGeometry args={[0.034, 16, 14]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          color={ATOM_COLORS.cpkHydrogen}
          roughness={0.22}
        />
      </mesh>
    </group>
  );
}
