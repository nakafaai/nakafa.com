import {
  fibreBeads,
  helixRungs,
  nucleosomeCenters,
} from "@repo/design-system/components/contents/biology/chromosome/packing";
import { MolecularStick } from "@repo/design-system/components/contents/biology/workbench";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { ATOM_COLORS } from "@repo/design-system/lib/material/atom";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

const PHOSPHATE_OXYGENS: readonly (readonly [number, number, number])[] = [
  [-0.08, 0.08, 0.04],
  [-0.08, -0.07, -0.05],
  [0.08, 0.06, -0.06],
  [0.08, -0.07, 0.06],
];

const HISTONE_SUBUNITS: readonly (readonly [number, number, number])[] = [
  [-0.042, 0.036, 0.036],
  [0.042, 0.036, 0.036],
  [-0.042, -0.036, 0.036],
  [0.042, -0.036, 0.036],
  [-0.042, 0.036, -0.036],
  [0.042, 0.036, -0.036],
  [-0.042, -0.036, -0.036],
  [0.042, -0.036, -0.036],
];

const BASE_PALETTE = [
  CELL_COLORS.adenine,
  CELL_COLORS.thymine,
  CELL_COLORS.guanine,
  CELL_COLORS.cytosine,
] as const;

/** Single nucleotide macromolecule: tetrahedral phosphate, deoxyribose pentose, and fused bicyclic purine base. */
export function NucleotideSpecimen({
  ink,
  parts,
}: {
  readonly ink: string;
  readonly parts: Readonly<Record<"base" | "phosphate" | "sugar", string>>;
}) {
  return (
    <group>
      <group position={[-0.5, 0.72, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.082, 24, 20]} />
          <meshPhysicalMaterial
            clearcoat={0.78}
            color={CELL_COLORS.phosphateNew}
            roughness={0.22}
          />
        </mesh>
        {Arr.map(PHOSPHATE_OXYGENS, (pos) => (
          <group key={`po-${pos[0]}-${pos[1]}-${pos[2]}`}>
            <mesh castShadow position={pos}>
              <sphereGeometry args={[0.048, 18, 14]} />
              <meshPhysicalMaterial
                clearcoat={0.75}
                color={ATOM_COLORS.cpkOxygen}
                roughness={0.24}
              />
            </mesh>
            <MolecularStick
              color={CELL_COLORS.phosphate}
              end={pos}
              radius={0.015}
              start={[0, 0, 0]}
            />
          </group>
        ))}
      </group>

      <MolecularStick
        color={CELL_COLORS.phosphate}
        end={[-0.17, 0.62, 0]}
        radius={0.018}
        start={[-0.42, 0.7, 0]}
      />

      <group position={[0, 0.56, 0]}>
        <mesh castShadow rotation={[Math.PI / 2, 0, Math.PI / 10]}>
          <cylinderGeometry args={[0.2, 0.2, 0.068, 5]} />
          <meshPhysicalMaterial
            clearcoat={0.58}
            clearcoatRoughness={0.26}
            color={CELL_COLORS.deoxyribose}
            roughness={0.34}
          />
        </mesh>
        <mesh castShadow position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.042, 16, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.75}
            color={ATOM_COLORS.cpkOxygen}
            roughness={0.22}
          />
        </mesh>
        <mesh castShadow position={[-0.11, -0.19, 0.02]}>
          <sphereGeometry args={[0.036, 14, 12]} />
          <meshPhysicalMaterial
            clearcoat={0.75}
            color={ATOM_COLORS.cpkOxygen}
            roughness={0.25}
          />
        </mesh>
      </group>

      <MolecularStick
        color={CELL_COLORS.deoxyribose}
        end={[0.32, 0.63, 0]}
        radius={0.018}
        start={[0.16, 0.6, 0]}
      />

      <group position={[0.48, 0.64, 0]}>
        <mesh castShadow position={[-0.1, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.115, 0.115, 0.056, 5]} />
          <meshPhysicalMaterial
            clearcoat={0.62}
            color={CELL_COLORS.adenine}
            roughness={0.3}
          />
        </mesh>
        <mesh castShadow position={[0.1, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.145, 0.145, 0.056, 6]} />
          <meshPhysicalMaterial
            clearcoat={0.62}
            color={CELL_COLORS.adenine}
            roughness={0.3}
          />
        </mesh>
        <mesh castShadow position={[0.25, 0.06, 0]}>
          <sphereGeometry args={[0.04, 16, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.78}
            color={GENETICS_COLORS.dnaBackboneA}
            roughness={0.22}
          />
        </mesh>
      </group>

      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[-0.5, 0.94, 0]}
      >
        {parts.phosphate}
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[0, 0.28, 0]}
      >
        {parts.sugar}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[0.52, 0.88, 0]}
      >
        {parts.base}
      </ThreeLabel>
    </group>
  );
}

/** Sculpted B-DNA double helix with glossy sugar-phosphate tubes and paired base rungs. */
export function DoubleHelixSpecimen({
  ink,
  label,
}: {
  readonly ink: string;
  readonly label: string;
}) {
  const rungs = useMemo(() => helixRungs(16), []);

  const { strandAGeo, strandBGeo } = useMemo(() => {
    const curveA = new CatmullRomCurve3(
      Arr.map(rungs, (r) => new Vector3(r.left[0], r.left[1], r.left[2]))
    );
    const curveB = new CatmullRomCurve3(
      Arr.map(rungs, (r) => new Vector3(r.right[0], r.right[1], r.right[2]))
    );
    return {
      strandAGeo: new TubeGeometry(curveA, 64, 0.026, 12, false),
      strandBGeo: new TubeGeometry(curveB, 64, 0.026, 12, false),
    };
  }, [rungs]);

  useEffect(
    () => () => {
      strandAGeo.dispose();
      strandBGeo.dispose();
    },
    [strandAGeo, strandBGeo]
  );

  return (
    <group>
      <mesh castShadow geometry={strandAGeo}>
        <meshPhysicalMaterial
          clearcoat={0.72}
          color={GENETICS_COLORS.dnaBackboneA}
          roughness={0.26}
        />
      </mesh>
      <mesh castShadow geometry={strandBGeo}>
        <meshPhysicalMaterial
          clearcoat={0.72}
          color={GENETICS_COLORS.dnaBackboneB}
          roughness={0.26}
        />
      </mesh>
      {Arr.map(rungs, (rung, idx) => {
        const mid: readonly [number, number, number] = [
          (rung.left[0] + rung.right[0]) * 0.5,
          (rung.left[1] + rung.right[1]) * 0.5,
          (rung.left[2] + rung.right[2]) * 0.5,
        ];
        const leftCol = BASE_PALETTE[idx % 4] ?? CELL_COLORS.adenine;
        const rightCol = BASE_PALETTE[(idx + 2) % 4] ?? CELL_COLORS.thymine;
        return (
          <group key={rung.id}>
            <mesh castShadow position={rung.left}>
              <sphereGeometry args={[0.036, 14, 12]} />
              <meshPhysicalMaterial
                clearcoat={0.76}
                color={CELL_COLORS.phosphate}
                roughness={0.22}
              />
            </mesh>
            <mesh castShadow position={rung.right}>
              <sphereGeometry args={[0.036, 14, 12]} />
              <meshPhysicalMaterial
                clearcoat={0.76}
                color={CELL_COLORS.phosphate}
                roughness={0.22}
              />
            </mesh>
            <MolecularStick
              color={leftCol}
              end={mid}
              radius={0.017}
              start={rung.left}
            />
            <MolecularStick
              color={rightCol}
              end={rung.right}
              radius={0.017}
              start={mid}
            />
            <mesh position={mid}>
              <sphereGeometry args={[0.02, 10, 8]} />
              <meshPhysicalMaterial
                color={GENETICS_COLORS.hBondCyan}
                emissive={GENETICS_COLORS.hBondCyan}
                emissiveIntensity={0.35}
                roughness={0.2}
              />
            </mesh>
          </group>
        );
      })}
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[0, 0.94, 0]}
      >
        {label}
      </ThreeLabel>
    </group>
  );
}

/** Sculpted beads-on-a-string nucleosomes with octameric histone spools and helical DNA wraps. */
export function NucleosomeSpecimen({
  ink,
  label,
}: {
  readonly ink: string;
  readonly label: string;
}) {
  const centers = useMemo(() => nucleosomeCenters(), []);

  const { linkerGeo, wrapGeo } = useMemo(() => {
    const linker = new CatmullRomCurve3(
      Arr.map(centers, ([x, y, z]) => new Vector3(x, y, z))
    );
    const wrapPts = Arr.makeBy(40, (i) => {
      const t = i / 39;
      const angle = t * Math.PI * 3.35;
      return new Vector3(
        Math.cos(angle) * 0.148,
        Math.sin(angle) * 0.148,
        (t - 0.5) * 0.115
      );
    });
    return {
      linkerGeo: new TubeGeometry(linker, 48, 0.018, 10, false),
      wrapGeo: new TubeGeometry(
        new CatmullRomCurve3(wrapPts),
        56,
        0.02,
        10,
        false
      ),
    };
  }, [centers]);

  useEffect(
    () => () => {
      linkerGeo.dispose();
      wrapGeo.dispose();
    },
    [linkerGeo, wrapGeo]
  );

  return (
    <group>
      <mesh castShadow geometry={linkerGeo}>
        <meshPhysicalMaterial
          clearcoat={0.68}
          color={GENETICS_COLORS.dnaBackboneB}
          roughness={0.28}
        />
      </mesh>
      {Arr.map(centers, ([x, y, z], idx) => (
        <group
          key={`nuc-${x}-${y}-${z}`}
          position={[x, y, z]}
          rotation={[0.25, idx * 0.45, 0.12]}
        >
          {Arr.map(HISTONE_SUBUNITS, (sub, sIdx) => (
            <mesh
              castShadow
              key={`sub-${sub[0]}-${sub[1]}-${sub[2]}`}
              position={sub}
            >
              <sphereGeometry args={[0.068, 16, 14]} />
              <meshPhysicalMaterial
                clearcoat={0.48}
                color={
                  sIdx % 2 === 0
                    ? GENETICS_COLORS.histoneCore
                    : GENETICS_COLORS.histoneGroove
                }
                roughness={0.38}
              />
            </mesh>
          ))}
          <mesh castShadow geometry={wrapGeo}>
            <meshPhysicalMaterial
              clearcoat={0.72}
              color={GENETICS_COLORS.dnaBackboneB}
              roughness={0.26}
            />
          </mesh>
        </group>
      ))}
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[0.22, 0.9, 0]}
      >
        {label}
      </ThreeLabel>
    </group>
  );
}

/** 30 nm chromatin solenoid fibre with packed nucleosome discs along a continuous supercoil. */
export function FibreSpecimen({
  ink,
  label,
}: {
  readonly ink: string;
  readonly label: string;
}) {
  const beads = useMemo(() => fibreBeads(24), []);

  const coilGeo = useMemo(() => {
    const curve = new CatmullRomCurve3(
      Arr.map(beads, ([x, y, z]) => new Vector3(x, y, z))
    );
    return new TubeGeometry(curve, 96, 0.034, 10, false);
  }, [beads]);

  useEffect(() => () => coilGeo.dispose(), [coilGeo]);

  return (
    <group>
      <mesh castShadow geometry={coilGeo}>
        <meshPhysicalMaterial
          clearcoat={0.62}
          color={GENETICS_COLORS.dnaBackboneB}
          roughness={0.32}
        />
      </mesh>
      {Arr.map(beads, ([x, y, z], idx) => (
        <group
          key={`fb-${x}-${y}-${z}`}
          position={[x, y, z]}
          rotation={[idx * 0.4, idx * 0.65, 0]}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.088, 0.088, 0.068, 22]} />
            <meshPhysicalMaterial
              clearcoat={0.52}
              color={
                idx % 2 === 0
                  ? GENETICS_COLORS.histoneCore
                  : GENETICS_COLORS.giemsaDark
              }
              roughness={0.38}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.092, 0.015, 10, 24]} />
            <meshPhysicalMaterial
              clearcoat={0.7}
              color={GENETICS_COLORS.dnaBackboneB}
              roughness={0.28}
            />
          </mesh>
        </group>
      ))}
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[0, 0.96, 0]}
      >
        {label}
      </ThreeLabel>
    </group>
  );
}
