import {
  Beaker,
  ColumnLiquid,
} from "@repo/design-system/components/contents/chemistry/bench";
import { latheProfile } from "@repo/design-system/components/contents/chemistry/glassware";
import type { SilicateMaterial } from "@repo/design-system/components/contents/chemistry/silicate/model";
import {
  AtomSphere,
  BondCylinder,
  FormulaPlaque,
} from "@repo/design-system/components/contents/chemistry/specimen";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";
import { LatheGeometry } from "three";

const SPECIMEN_X = -0.22;
export const STAGE_X = 0.125;
export const RIG_Z = 0.04;

const CRUCIBLE_PROFILE = latheProfile([
  [0.001, 0],
  [0.03, 0],
  [0.036, 0.008],
  [0.044, 0.038],
  [0.046, 0.068],
  [0.049, 0.074],
  [0.045, 0.076],
  [0.04, 0.068],
  [0.037, 0.038],
  [0.029, 0.01],
  [0.001, 0.008],
]);

const BEARING_PROFILE = latheProfile([
  [0.022, 0],
  [0.042, 0],
  [0.046, 0.006],
  [0.046, 0.044],
  [0.042, 0.05],
  [0.022, 0.05],
  [0.018, 0.044],
  [0.018, 0.006],
  [0.022, 0],
]);

const TETRA_VERTICES = [
  [0, 0.025, 0],
  [0.023, -0.008, 0],
  [-0.012, -0.008, 0.02],
  [-0.012, -0.008, -0.02],
] as const;

const TRIGONAL_VERTICES = [
  [0, 0.024, 0],
  [0.021, -0.012, 0],
  [-0.021, -0.012, 0],
] as const;

const AMORPHOUS_NODES = [
  {
    id: "a-0",
    isBoron: false,
    pos: [-0.075, -0.036, 0.014] as const,
    rot: [0.2, 0.3, 0.1] as const,
  },
  {
    id: "a-1",
    isBoron: true,
    pos: [-0.022, 0.008, -0.016] as const,
    rot: [-0.15, 0.5, 0.25] as const,
  },
  {
    id: "a-2",
    isBoron: false,
    pos: [0.032, -0.028, 0.018] as const,
    rot: [0.35, -0.2, 0.18] as const,
  },
  {
    id: "a-3",
    isBoron: false,
    pos: [0.078, 0.016, -0.012] as const,
    rot: [-0.25, 0.4, -0.1] as const,
  },
  {
    id: "a-4",
    isBoron: false,
    pos: [-0.062, 0.042, 0.012] as const,
    rot: [0.1, -0.35, 0.22] as const,
  },
  {
    id: "a-5",
    isBoron: true,
    pos: [0.022, 0.048, -0.018] as const,
    rot: [0.22, 0.18, -0.28] as const,
  },
  {
    id: "a-6",
    isBoron: false,
    pos: [-0.018, -0.048, -0.014] as const,
    rot: [-0.3, -0.15, 0.12] as const,
  },
] as const;

const AMORPHOUS_BRIDGES: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [0, 4],
  [4, 1],
  [1, 5],
  [5, 3],
  [0, 6],
  [6, 2],
];

const SODALIME_MODIFIERS = [
  { id: "na-0", pos: [-0.044, -0.012, 0.036] as const },
  { id: "na-1", pos: [0.056, -0.006, 0.028] as const },
  { id: "na-2", pos: [0.004, 0.022, 0.032] as const },
] as const;

const CLAY_COLUMNS = [-0.068, -0.023, 0.023, 0.068] as const;
const CLAY_DEPTHS = [-0.026, 0.026] as const;

const GRAIN_CELLS = Arr.makeBy(12, (idx) => {
  const col = idx % 4;
  const row = Math.floor(idx / 4);
  return {
    id: `gr-${idx}`,
    pos: [
      -0.066 + col * 0.044,
      -0.036 + row * 0.04,
      ((col + row) % 2 === 0 ? 1 : -1) * 0.012,
    ] as const,
  };
});

/** Macroscopic physical specimen on the bench illustrating the selected glass or ceramic material. */
export function MacroMaterialSpecimen({
  material,
}: {
  readonly material: SilicateMaterial;
}) {
  const crucibleGeo = useMemo(
    () => new LatheGeometry(CRUCIBLE_PROFILE, 44),
    []
  );
  const bearingGeo = useMemo(() => new LatheGeometry(BEARING_PROFILE, 44), []);
  useEffect(() => () => crucibleGeo.dispose(), [crucibleGeo]);
  useEffect(() => () => bearingGeo.dispose(), [bearingGeo]);

  const plaque = Match.value(material).pipe(
    Match.when("sodaLimeGlass", () => ({
      formula: "SiO₂ · Na₂O",
      subtitle: "SODA-LIME GLASS",
    })),
    Match.when("borosilicateGlass", () => ({
      formula: "SiO₂ · B₂O₃",
      subtitle: "BOROSILICATE",
    })),
    Match.when("traditionalCeramic", () => ({
      formula: "Al₂Si₂O₅(OH)₄",
      subtitle: "KAOLINITE CLAY",
    })),
    Match.when("advancedCeramic", () => ({
      formula: "Al₂O₃ / SiC",
      subtitle: "SINTERED CERAMIC",
    })),
    Match.exhaustive
  );

  return (
    <group position={[SPECIMEN_X, 0, RIG_Z]}>
      {/* Turned brass & slate specimen coaster */}
      <mesh castShadow position={[0, 0.005, 0]} receiveShadow>
        <cylinderGeometry args={[0.068, 0.074, 0.01, 44]} />
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={CAR_COLORS.dashboard}
          metalness={0.45}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 0.011, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.066, 0.0022, 12, 48]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
      </mesh>

      <group position={[0, 0.01, 0]}>
        {Match.value(material).pipe(
          Match.when("sodaLimeGlass", () => (
            <group>
              <mesh castShadow position={[0, 0.008, 0]}>
                <boxGeometry args={[0.082, 0.016, 0.032]} />
                <MetalMaterial
                  color={INSTRUMENT_COLORS.brass}
                  roughness={0.28}
                />
              </mesh>
              <mesh castShadow position={[0, 0.064, 0]} renderOrder={2}>
                <boxGeometry args={[0.076, 0.098, 0.012]} />
                <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.42} />
              </mesh>
            </group>
          )),
          Match.when("borosilicateGlass", () => (
            <group scale={1.38}>
              <ColumnLiquid
                bottom={0.004}
                color={REAGENT_COLORS.solution}
                level={0.044}
                opacity={0.62}
                radius={0.0238}
              />
              <Beaker />
            </group>
          )),
          Match.when("traditionalCeramic", () => (
            <mesh castShadow geometry={crucibleGeo} receiveShadow>
              <meshPhysicalMaterial
                clearcoat={0.22}
                clearcoatRoughness={0.58}
                color={PROCESS_COLORS.alloyBronze}
                roughness={0.68}
              />
            </mesh>
          )),
          Match.when("advancedCeramic", () => (
            <group>
              <mesh
                castShadow
                geometry={bearingGeo}
                position={[0, 0.046, 0]}
                receiveShadow
                rotation={[Math.PI / 2, 0, 0]}
              >
                <meshPhysicalMaterial
                  clearcoat={0.85}
                  clearcoatRoughness={0.1}
                  color={PROCESS_COLORS.ceramicIvory}
                  metalness={0.08}
                  roughness={0.18}
                />
              </mesh>
              <mesh position={[0, 0.004, 0]}>
                <boxGeometry args={[0.066, 0.008, 0.044]} />
                <MetalMaterial color={CAR_COLORS.castIron} roughness={0.45} />
              </mesh>
            </group>
          )),
          Match.exhaustive
        )}
      </group>

      <FormulaPlaque
        formula={plaque.formula}
        position={[0, 0.026, 0.096]}
        subtitle={plaque.subtitle}
        width={0.132}
      />
    </group>
  );
}

function SilicaTetrahedronNode({
  position,
  rotation,
}: {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <tetrahedronGeometry args={[0.024, 0]} />
        <meshPhysicalMaterial
          clearcoat={0.85}
          color={PROCESS_COLORS.silicaBlue}
          depthWrite={false}
          opacity={0.34}
          roughness={0.12}
          transparent
        />
      </mesh>
      <AtomSphere
        color={PROCESS_COLORS.silicaBlue}
        position={[0, 0, 0]}
        radius={0.0082}
      />
      {Arr.map(TETRA_VERTICES, (v) => (
        <group key={`tv-${v[0]}-${v[1]}-${v[2]}`}>
          <BondCylinder end={v} radius={0.0018} start={[0, 0, 0]} />
          <AtomSphere
            color={PROCESS_COLORS.acidRed}
            position={v}
            radius={0.0056}
          />
        </group>
      ))}
    </group>
  );
}

function BoronTrigonalNode({
  position,
  rotation,
}: {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <AtomSphere
        color={PROCESS_COLORS.boronMint}
        emissive={PROCESS_COLORS.boronMint}
        emissiveIntensity={0.28}
        position={[0, 0, 0]}
        radius={0.0092}
      />
      {Arr.map(TRIGONAL_VERTICES, (v) => (
        <group key={`bv-${v[0]}-${v[1]}-${v[2]}`}>
          <BondCylinder
            color={PROCESS_COLORS.boronMint}
            end={v}
            radius={0.002}
            start={[0, 0, 0]}
          />
          <AtomSphere
            color={PROCESS_COLORS.acidRed}
            position={v}
            radius={0.0056}
          />
        </group>
      ))}
    </group>
  );
}

/** Disordered continuous random silicate network for soda-lime or borosilicate glass. */
export function AmorphousGlassNetwork({
  hasBoron,
}: {
  readonly hasBoron: boolean;
}) {
  return (
    <group>
      {Arr.map(AMORPHOUS_BRIDGES, ([aIdx, bIdx]) => {
        const a = AMORPHOUS_NODES[aIdx];
        const b = AMORPHOUS_NODES[bIdx];
        if (a === undefined || b === undefined) {
          return null;
        }
        return (
          <BondCylinder
            color={BENCH_COLORS.panSteel}
            end={b.pos}
            key={`ab-${aIdx}-${bIdx}`}
            opacity={0.78}
            radius={0.0022}
            start={a.pos}
          />
        );
      })}
      {Arr.map(AMORPHOUS_NODES, (node) =>
        hasBoron && node.isBoron ? (
          <BoronTrigonalNode
            key={node.id}
            position={node.pos}
            rotation={node.rot}
          />
        ) : (
          <SilicaTetrahedronNode
            key={node.id}
            position={node.pos}
            rotation={node.rot}
          />
        )
      )}
      {/* Interstitial Na+ / Ca2+ network modifier ions in soda-lime glass */}
      {hasBoron
        ? null
        : Arr.map(SODALIME_MODIFIERS, (ion) => (
            <AtomSphere
              color={PROCESS_COLORS.electronGold}
              emissive={PROCESS_COLORS.electronGold}
              emissiveIntensity={0.2}
              key={ion.id}
              position={ion.pos}
              radius={0.0076}
            />
          ))}
    </group>
  );
}

/** Stacked corrugated aluminosilicate clay sheets with interlayer hydrogen-bond pillars. */
export function LayeredClaySheets() {
  const sheetYs = [-0.036, 0.034] as const;

  return (
    <group>
      {Arr.map(sheetYs, (sy) => {
        const isLower = sy < 0;
        return (
          <group key={`sheet-${sy}`} position={[0, sy, 0]}>
            {/* Continuous clay platelet lamina */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.172, 0.012, 0.088]} />
              <meshPhysicalMaterial
                clearcoat={0.2}
                color={
                  isLower
                    ? PROCESS_COLORS.alloyBronze
                    : PROCESS_COLORS.ceramicIvory
                }
                roughness={0.62}
              />
            </mesh>
            {/* Linked tetrahedral silicate / octahedral aluminate sheet nodes */}
            {Arr.map(CLAY_COLUMNS, (cx) =>
              Arr.map(CLAY_DEPTHS, (cz) => (
                <group key={`cl-${sy}-${cx}-${cz}`} position={[cx, 0.012, cz]}>
                  <AtomSphere
                    color={
                      isLower
                        ? PROCESS_COLORS.silicaBlue
                        : PROCESS_COLORS.alloySteel
                    }
                    position={[0, 0, 0]}
                    radius={0.0072}
                  />
                  <AtomSphere
                    color={PROCESS_COLORS.acidRed}
                    position={[0, 0.011, 0]}
                    radius={0.0048}
                  />
                </group>
              ))
            )}
          </group>
        );
      })}
      {/* Translucent interlayer water / hydrogen-bond bridges */}
      {Arr.map(CLAY_COLUMNS, (cx) => (
        <BondCylinder
          color={PROCESS_COLORS.coldBlue}
          end={[cx, 0.028, 0]}
          key={`hb-${cx}`}
          opacity={0.55}
          radius={0.002}
          start={[cx, -0.024, 0]}
        />
      ))}
    </group>
  );
}

/** High-density ordered sintered polycrystalline ceramic grains with zero porosity. */
export function SinteredCeramicGrains() {
  return (
    <group>
      {Arr.map(GRAIN_CELLS, (grain, idx) => (
        <group key={grain.id} position={grain.pos}>
          <mesh
            castShadow
            receiveShadow
            rotation={[idx * 0.3, idx * 0.45, 0.2]}
          >
            <dodecahedronGeometry args={[0.021, 0]} />
            <meshPhysicalMaterial
              clearcoat={0.78}
              clearcoatRoughness={0.14}
              color={
                idx % 3 === 0
                  ? BENCH_COLORS.panSteel
                  : PROCESS_COLORS.ceramicIvory
              }
              metalness={0.14}
              roughness={0.22}
            />
          </mesh>
          <AtomSphere
            color={PROCESS_COLORS.catalystTeal}
            position={[0, 0, 0.02]}
            radius={0.0046}
          />
        </group>
      ))}
    </group>
  );
}
