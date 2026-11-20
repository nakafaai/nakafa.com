import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { DoubleSide } from "three";

/** How wide and deep each block of envelope is, in scene units. */
const BLOCK = { depth: 0.5, width: 0.9 } as const;

/** How far apart the lipid heads of a leaflet sit. */
const HEAD_GAP = 0.04;

/** The grid of lipid heads of one leaflet at height `y`. */
function leafletHeads(y: number) {
  const columns = Math.floor(BLOCK.width / HEAD_GAP);
  const rows = Math.floor(BLOCK.depth / HEAD_GAP);
  return Arr.flatMap(Arr.range(0, columns - 1), (column) =>
    Arr.map(Arr.range(0, rows - 1), (row) => ({
      position: [
        -BLOCK.width / 2 + (column + 0.5 + (row % 2) * 0.5) * HEAD_GAP,
        y,
        -BLOCK.depth / 2 + (row + 0.5) * HEAD_GAP,
      ] as const,
    }))
  );
}

/**
 * A phospholipid bilayer with its bottom at `y`: two leaflets of polar heads
 * facing out, the fatty-acid tails between them, and a few transmembrane
 * proteins spanning it.
 */
function Bilayer({ y }: { readonly y: number }) {
  const heads = useMemo(
    () => [...leafletHeads(y + 0.012), ...leafletHeads(y + 0.068)],
    [y]
  );
  return (
    <group>
      <Instances placements={heads}>
        <sphereGeometry args={[0.014, 10, 8]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={CELL_COLORS.lipidHead}
          roughness={0.4}
        />
      </Instances>
      <mesh position={[0, y + 0.04, 0]}>
        <boxGeometry args={[BLOCK.width, 0.04, BLOCK.depth]} />
        <meshStandardMaterial color={CELL_COLORS.lipidTail} roughness={0.7} />
      </mesh>
      {Arr.map([-0.25, 0.1, 0.32] as const, (x) => (
        <mesh castShadow key={x} position={[x, y + 0.04, x * 0.3]}>
          <cylinderGeometry args={[0.03, 0.034, 0.1, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={CELL_COLORS.membraneProtein}
            roughness={0.45}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Peptidoglycan from `y` upward: `layers` sheets of glycan strands running
 * one way, cross-linked by short peptide bridges the other way.
 */
function Peptidoglycan({
  layers,
  y,
}: {
  readonly layers: number;
  readonly y: number;
}) {
  const strands = useMemo(
    () =>
      Arr.flatMap(Arr.range(0, layers - 1), (layer) =>
        Arr.map(Arr.range(0, 9), (row) => ({
          position: [
            0,
            y + 0.012 + layer * 0.03,
            -BLOCK.depth / 2 + 0.025 + row * 0.05,
          ] as const,
          rotation: [0, 0, Math.PI / 2] as const,
          scale: [1, BLOCK.width, 1] as const,
        }))
      ),
    [layers, y]
  );
  const bridges = useMemo(
    () =>
      Arr.flatMap(Arr.range(0, layers - 1), (layer) =>
        Arr.flatMap(Arr.range(0, 8), (row) =>
          Arr.map(Arr.range(0, 8), (column) => ({
            position: [
              -BLOCK.width / 2 +
                0.05 +
                column * 0.1 +
                ((row + layer) % 2) * 0.05,
              y + 0.012 + layer * 0.03,
              -BLOCK.depth / 2 + 0.05 + row * 0.05,
            ] as const,
            rotation: [Math.PI / 2, 0, 0] as const,
            scale: [1, 0.05, 1] as const,
          }))
        )
      ),
    [layers, y]
  );
  return (
    <group>
      <Instances placements={strands}>
        <cylinderGeometry args={[0.009, 0.009, 1, 6]} />
        <meshStandardMaterial color={CELL_COLORS.glycan} roughness={0.5} />
      </Instances>
      <Instances placements={bridges}>
        <cylinderGeometry args={[0.005, 0.005, 1, 5]} />
        <meshStandardMaterial
          color={CELL_COLORS.peptideBridge}
          roughness={0.5}
        />
      </Instances>
    </group>
  );
}

/** Thin chains standing up from `y`, each `length` long with a bead on top: teichoic acids or lipopolysaccharide. */
function Chains({
  color,
  count,
  length,
  y,
}: {
  readonly color: string;
  readonly count: number;
  readonly length: number;
  readonly y: number;
}) {
  const spots = useMemo(
    () =>
      Arr.map(Arr.range(0, count - 1), (index) => {
        const x =
          -BLOCK.width / 2 +
          0.03 +
          ((index * 0.618) % 1) * (BLOCK.width - 0.06);
        const z =
          -BLOCK.depth / 2 +
          0.03 +
          ((index * 0.381) % 1) * (BLOCK.depth - 0.06);
        const reach = length * (0.75 + ((index * 0.27) % 0.5));
        return { reach, x, z };
      }),
    [count, length]
  );
  return (
    <group>
      <Instances
        placements={Arr.map(spots, ({ reach, x, z }) => ({
          position: [x, y + reach / 2, z] as const,
          scale: [1, reach, 1] as const,
        }))}
      >
        <cylinderGeometry args={[0.005, 0.005, 1, 5]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </Instances>
      <Instances
        placements={Arr.map(spots, ({ reach, x, z }) => ({
          position: [x, y + reach, z] as const,
        }))}
      >
        <sphereGeometry args={[0.012, 8, 6]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </Instances>
    </group>
  );
}

/**
 * A block cut from a bacterial envelope, cytoplasm at the bottom and the
 * outside at the top. A Gram-positive wall is one membrane under a thick
 * peptidoglycan mesh, 20 to 40 nm, threaded with teichoic acids; a
 * Gram-negative wall is an inner membrane, the periplasm with a thin
 * peptidoglycan layer, and an outer membrane with porins and a fringe of
 * lipopolysaccharide.
 */
export function BacterialWallStack({
  gram,
  label,
  textColor,
  x,
}: {
  readonly gram: "negative" | "positive";
  readonly label?: ReactNode;
  readonly textColor: string;
  readonly x: number;
}) {
  return (
    <group position={[x, -0.3, 0]}>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[BLOCK.width, 0.1, BLOCK.depth]} />
        <meshPhysicalMaterial color={CELL_COLORS.cytosol} roughness={0.6} />
      </mesh>
      <Bilayer y={0} />
      {gram === "positive" ? (
        <group>
          <Peptidoglycan layers={10} y={0.08} />
          <Chains
            color={CELL_COLORS.teichoic}
            count={28}
            length={0.38}
            y={0.08}
          />
        </group>
      ) : (
        <group>
          <mesh position={[0, 0.14, 0]}>
            <boxGeometry args={[BLOCK.width, 0.12, BLOCK.depth]} />
            <meshPhysicalMaterial
              color={CELL_COLORS.periplasm}
              depthWrite={false}
              opacity={0.35}
              roughness={0.4}
              transparent
            />
          </mesh>
          <Peptidoglycan layers={2} y={0.13} />
          <Bilayer y={0.2} />
          {Arr.map([-0.28, 0.02, 0.3] as const, (porin) => (
            <mesh key={porin} position={[porin, 0.24, -porin * 0.4]}>
              <cylinderGeometry args={[0.038, 0.038, 0.1, 16, 1, true]} />
              <meshPhysicalMaterial
                clearcoat={0.4}
                color={CELL_COLORS.porin}
                roughness={0.4}
                side={DoubleSide}
              />
            </mesh>
          ))}
          <Chains
            color={CELL_COLORS.lipopolysaccharide}
            count={60}
            length={0.14}
            y={0.28}
          />
        </group>
      )}
      {label === undefined ? null : (
        <ThreeLabel
          color={textColor}
          fontSize="compact"
          position={[0, 0.62, 0.3]}
        >
          {label}
        </ThreeLabel>
      )}
    </group>
  );
}
