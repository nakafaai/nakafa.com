import { RoundedBox } from "@react-three/drei";
import type {
  Size,
  Sort,
} from "@repo/design-system/components/contents/mathematics/counterexample/layout";
import { DIVIDER } from "@repo/design-system/components/contents/mathematics/counterexample/layout";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { COUNTEREXAMPLE_COLORS } from "@repo/design-system/lib/material/counterexample";
import { Array as Arr } from "effect";

/** How high the felt lies above the table, in metres: the tiles lie on it. */
export const FELT_TOP = 0.012;

/** How wide the oak frame round the felt is, and how far it stands above the felt. */
const FRAME = { lip: 0.004, width: 0.016 } as const;

/** How high a cell's dyed felt and its oak strips stand above the board's felt. */
const CELL = { felt: 0.0008, strip: 0.006 } as const;

/** The dyed felt of each cell of the case board: p and q, p alone, q alone, neither. */
const CELL_FELTS = [
  COUNTEREXAMPLE_COLORS.feltFits,
  COUNTEREXAMPLE_COLORS.feltBreaks,
  COUNTEREXAMPLE_COLORS.feltSafe,
  COUNTEREXAMPLE_COLORS.feltSafe,
] as const;

/**
 * A charcoal felt board in an oiled oak frame, `size` of felt inside the
 * frame: an oak base under the felt, and four rails that stand a little
 * above it.
 */
export function FeltBoard({ size }: { readonly size: Size }) {
  const outer = {
    depth: size.depth + 2 * FRAME.width,
    width: size.width + 2 * FRAME.width,
  };
  const rails = [
    {
      args: [FRAME.width, outer.depth],
      at: [(size.width + FRAME.width) / 2, 0],
    },
    {
      args: [FRAME.width, outer.depth],
      at: [-(size.width + FRAME.width) / 2, 0],
    },
    {
      args: [size.width, FRAME.width],
      at: [0, (size.depth + FRAME.width) / 2],
    },
    {
      args: [size.width, FRAME.width],
      at: [0, -(size.depth + FRAME.width) / 2],
    },
  ] as const;

  return (
    <group>
      <RoundedBox
        args={[outer.width, FELT_TOP, outer.depth]}
        castShadow
        position={[0, FELT_TOP / 2, 0]}
        radius={0.003}
        receiveShadow
        smoothness={6}
      >
        <Matter of="oak" />
      </RoundedBox>
      {Arr.map(rails, ({ args, at }) => (
        <mesh
          castShadow
          key={`${at[0]}-${at[1]}`}
          position={[at[0], FELT_TOP + FRAME.lip / 2, at[1]]}
          receiveShadow
        >
          <boxGeometry args={[args[0], FRAME.lip, args[1]]} />
          <Matter of="oak" />
        </mesh>
      ))}
      <mesh
        position={[0, FELT_TOP + 0.0002, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[size.width, size.depth]} />
        <Matter color={COUNTEREXAMPLE_COLORS.felt} of="felt" />
      </mesh>
    </group>
  );
}

/**
 * The four cells of the case board: dyed felt for what each case does to
 * an implication, green where p and q are both true, red where p is true and
 * q false, and grey across the front row, where p is false and no tile can
 * break the claim. Oak strips part the cells.
 */
export function CaseCells({ sort }: { readonly sort: Sort }) {
  const inner = {
    depth: 2 * sort.cell.depth + DIVIDER,
    width: 2 * sort.cell.width + DIVIDER,
  };

  return (
    <group>
      {Arr.map(sort.centres, (centre, index) => (
        <mesh
          key={`${centre.x}-${centre.z}`}
          position={[centre.x, FELT_TOP + CELL.felt, centre.z]}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[sort.cell.width, sort.cell.depth]} />
          <Matter color={Arr.getUnsafe(CELL_FELTS, index)} of="felt" />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[0, FELT_TOP + CELL.strip / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[DIVIDER, CELL.strip, inner.depth]} />
        <Matter of="oak" />
      </mesh>
      <mesh
        castShadow
        position={[0, FELT_TOP + CELL.strip / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[inner.width, CELL.strip, DIVIDER]} />
        <Matter of="oak" />
      </mesh>
    </group>
  );
}
