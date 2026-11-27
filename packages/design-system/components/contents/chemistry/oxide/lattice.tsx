import type { PeriodOxide } from "@repo/design-system/components/contents/chemistry/oxide/model";
import {
  AtomSphere,
  BondCylinder,
  FormulaPlaque,
  MultiBond,
  SpecimenPlinth,
} from "@repo/design-system/components/contents/chemistry/specimen";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Match } from "effect";
import type { RefObject } from "react";
import type { Group } from "three";

export const LATTICE_X = 0.19;
export const LATTICE_Z = 0.04;

const IONIC_COORDS = Arr.makeBy(8, (index) => {
  const ix = index % 2;
  const iy = Math.floor(index / 4);
  const iz = Math.floor((index % 4) / 2);
  const isOxide = (ix + iy + iz) % 2 === 1;
  return {
    id: `ion-${index}`,
    isOxide,
    pos: [(ix - 0.5) * 0.072, (iy - 0.5) * 0.072, (iz - 0.5) * 0.072] as const,
  };
});

const IONIC_EDGES: readonly (readonly [number, number])[] = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

const SILICA_CENTERS = [
  [-0.036, -0.024, 0.02],
  [0.036, -0.024, -0.02],
  [0, 0.036, 0],
] as const;

const TETRA_DIRS = [
  [0, 1, 0],
  [0.94, -0.33, 0],
  [-0.47, -0.33, 0.81],
  [-0.47, -0.33, -0.81],
] as const;

const P4_VERTICES = [
  [0, 0.044, 0],
  [0.041, -0.015, 0.024],
  [-0.041, -0.015, 0.024],
  [0, -0.015, -0.047],
] as const;

const P4_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [2, 3],
  [3, 1],
];

const SO2_MOLECULES = [
  {
    id: "so2-0",
    pos: [-0.042, 0.028, 0.014] as const,
    rot: [0.15, 0.3, 0.1] as const,
  },
  {
    id: "so2-1",
    pos: [0.044, -0.018, -0.016] as const,
    rot: [-0.2, -0.45, -0.15] as const,
  },
  {
    id: "so2-2",
    pos: [0, -0.032, 0.034] as const,
    rot: [0.28, 0.1, 0.2] as const,
  },
] as const;

function plaqueMeta(oxide: PeriodOxide) {
  return Match.value(oxide).pipe(
    Match.when("na2o", () => ({ formula: "Na₂O", subtitle: "GIANT IONIC" })),
    Match.when("mgo", () => ({ formula: "MgO", subtitle: "GIANT IONIC" })),
    Match.when("al2o3", () => ({
      formula: "Al₂O₃",
      subtitle: "AMPHOTERIC IONIC",
    })),
    Match.when("sio2", () => ({ formula: "SiO₂", subtitle: "GIANT COVALENT" })),
    Match.when("p4o10", () => ({
      formula: "P₄O₁₀",
      subtitle: "MOLECULAR CAGE",
    })),
    Match.when("so2", () => ({ formula: "SO₂", subtitle: "SIMPLE MOLECULAR" })),
    Match.exhaustive
  );
}

function cationColor(oxide: PeriodOxide): string {
  return Match.value(oxide).pipe(
    Match.when("na2o", () => PROCESS_COLORS.alkaliPurple),
    Match.when("mgo", () => PROCESS_COLORS.weakBaseTeal),
    Match.when("al2o3", () => PROCESS_COLORS.anodeZinc),
    Match.orElse(() => PROCESS_COLORS.silicaBlue)
  );
}

function IonicLatticeModel({ oxide }: { readonly oxide: PeriodOxide }) {
  const metalColor = cationColor(oxide);
  return (
    <group>
      {Arr.map(IONIC_EDGES, ([aIdx, bIdx]) => {
        const a = IONIC_COORDS[aIdx];
        const b = IONIC_COORDS[bIdx];
        if (a === undefined || b === undefined) {
          return null;
        }
        return (
          <BondCylinder
            color={BENCH_COLORS.panSteel}
            end={b.pos}
            key={`e-${aIdx}-${bIdx}`}
            opacity={0.72}
            radius={0.0024}
            start={a.pos}
          />
        );
      })}
      {Arr.map(IONIC_COORDS, (node) => (
        <AtomSphere
          color={node.isOxide ? PROCESS_COLORS.acidRed : metalColor}
          key={node.id}
          position={node.pos}
          radius={node.isOxide ? 0.017 : 0.0145}
        />
      ))}
    </group>
  );
}

function GiantCovalentSilicaModel() {
  return (
    <group>
      {Arr.map(SILICA_CENTERS, (center) => (
        <group key={`si-${center[0]}-${center[1]}-${center[2]}`}>
          <AtomSphere
            color={PROCESS_COLORS.silicaBlue}
            position={center}
            radius={0.0145}
          />
          {Arr.map(TETRA_DIRS, (dir) => {
            const ox = [
              center[0] + dir[0] * 0.032,
              center[1] + dir[1] * 0.032,
              center[2] + dir[2] * 0.032,
            ] as const;
            return (
              <group key={`o-${center[0]}-${dir[0]}-${dir[1]}-${dir[2]}`}>
                <BondCylinder end={ox} radius={0.0028} start={center} />
                <AtomSphere
                  color={PROCESS_COLORS.acidRed}
                  position={ox}
                  radius={0.0102}
                />
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function PhosphorusPentoxideCage() {
  return (
    <group>
      {Arr.map(P4_VERTICES, (p) => {
        const len = Math.hypot(p[0], p[1], p[2]);
        const termO = [
          p[0] * (1 + 0.028 / len),
          p[1] * (1 + 0.028 / len),
          p[2] * (1 + 0.028 / len),
        ] as const;
        return (
          <group key={`p-${p[0]}-${p[1]}-${p[2]}`}>
            <AtomSphere
              color={PROCESS_COLORS.vanadiumOrange}
              position={p}
              radius={0.0132}
            />
            <MultiBond
              end={termO}
              gap={0.0046}
              order={2}
              radius={0.0024}
              start={p}
            />
            <AtomSphere
              color={PROCESS_COLORS.acidRed}
              position={termO}
              radius={0.0098}
            />
          </group>
        );
      })}
      {Arr.map(P4_PAIRS, ([aIdx, bIdx]) => {
        const a = P4_VERTICES[aIdx];
        const b = P4_VERTICES[bIdx];
        if (a === undefined || b === undefined) {
          return null;
        }
        const mid = [
          (a[0] + b[0]) * 0.62,
          (a[1] + b[1]) * 0.62,
          (a[2] + b[2]) * 0.62,
        ] as const;
        return (
          <group key={`bridge-${aIdx}-${bIdx}`}>
            <BondCylinder end={mid} radius={0.0026} start={a} />
            <BondCylinder end={b} radius={0.0026} start={mid} />
            <AtomSphere
              color={PROCESS_COLORS.acidRed}
              position={mid}
              radius={0.0096}
            />
          </group>
        );
      })}
    </group>
  );
}

function SulfurDioxideMolecules() {
  return (
    <group>
      {Arr.map(SO2_MOLECULES, (mol) => {
        const s = [0, 0.006, 0] as const;
        const o1 = [-0.024, -0.008, 0] as const;
        const o2 = [0.024, -0.008, 0] as const;
        return (
          <group key={mol.id} position={mol.pos} rotation={mol.rot}>
            <MultiBond
              end={o1}
              gap={0.0044}
              order={2}
              radius={0.0024}
              start={s}
            />
            <MultiBond
              end={o2}
              gap={0.0044}
              order={2}
              radius={0.0024}
              start={s}
            />
            <AtomSphere
              color={PROCESS_COLORS.sulfurYellow}
              position={s}
              radius={0.013}
            />
            <AtomSphere
              color={PROCESS_COLORS.acidRed}
              position={o1}
              radius={0.0102}
            />
            <AtomSphere
              color={PROCESS_COLORS.acidRed}
              position={o2}
              radius={0.0102}
            />
          </group>
        );
      })}
    </group>
  );
}

/** Elevated crystallography turntable showcasing each Period 3 oxide's atomic microstructure. */
export function OxideMicrostructure({
  oxide,
  turntableRef,
}: {
  readonly oxide: PeriodOxide;
  readonly turntableRef: RefObject<Group | null>;
}) {
  const meta = plaqueMeta(oxide);

  return (
    <group position={[LATTICE_X, 0, LATTICE_Z]}>
      <SpecimenPlinth depth={0.21} height={0.014} width={0.24} />
      <mesh position={[0, 0.029, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.072, 0.0026, 12, 48]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
      </mesh>
      <FormulaPlaque
        formula={meta.formula}
        position={[0, 0.036, 0.118]}
        subtitle={meta.subtitle}
        width={0.145}
      />
      <group position={[0, 0.125, 0]} ref={turntableRef}>
        {Match.value(oxide).pipe(
          Match.when("na2o", () => <IonicLatticeModel oxide="na2o" />),
          Match.when("mgo", () => <IonicLatticeModel oxide="mgo" />),
          Match.when("al2o3", () => <IonicLatticeModel oxide="al2o3" />),
          Match.when("sio2", () => <GiantCovalentSilicaModel />),
          Match.when("p4o10", () => <PhosphorusPentoxideCage />),
          Match.when("so2", () => <SulfurDioxideMolecules />),
          Match.exhaustive
        )}
      </group>
    </group>
  );
}
