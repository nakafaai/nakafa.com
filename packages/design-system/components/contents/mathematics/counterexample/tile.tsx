import { RoundedBox } from "@react-three/drei";
import type { Tile } from "@repo/design-system/components/contents/mathematics/counterexample/claim";
import { TILE } from "@repo/design-system/components/contents/mathematics/counterexample/layout";
import { PrintFace } from "@repo/design-system/components/three/print/layer";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { words } from "@repo/design-system/components/three/print/sheet";
import { COUNTEREXAMPLE_COLORS } from "@repo/design-system/lib/material/counterexample";
import { useMemo } from "react";

/** How much of the tile's top the printed face covers. */
const FACE_SHARE = 0.9;

/** How thick a painted shape standing on a tile is, in metres. */
const SHAPE_HEIGHT = 0.008;

/** The minus sign a negative number is printed with, which is as wide as a digit. */
const MINUS = "−";

/**
 * One number as printed on a tile's face: dark ink, bold figures, as large
 * as the face allows. The print is ink alone, so the maple of the tile
 * shows round the figures.
 */
function numberSheet(value: number): Sheet {
  const side = TILE.side * FACE_SHARE;
  return {
    height: side,
    marks: [
      words({
        at: [0, 0],
        box: {
          height: side,
          leading: 1,
          smallest: side * 0.2,
          width: side * 0.78,
        },
        ink: COUNTEREXAMPLE_COLORS.ink,
        size: side * 0.58,
        text: `${value < 0 ? MINUS : ""}${Math.abs(value)}`,
      }),
    ],
    width: side,
  };
}

/** A number printed on the top of a tile. */
function NumberFace({ value }: { readonly value: number }) {
  const sheet = useMemo(() => numberSheet(value), [value]);

  return (
    <group
      position={[0, TILE.height / 2 + 0.0004, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <PrintFace sheet={sheet} stock="ink" />
    </group>
  );
}

/** A painted wooden shape standing on the top of a tile: a disc, a square, or a triangle that points away. */
function ShapeToken({
  tile,
}: {
  readonly tile: Extract<Tile, { kind: "shape" }>;
}) {
  const color = COUNTEREXAMPLE_COLORS[tile.color];
  const y = TILE.height / 2 + SHAPE_HEIGHT / 2;

  if (tile.shape === "square") {
    return (
      <RoundedBox
        args={[0.042, SHAPE_HEIGHT, 0.042]}
        castShadow
        position={[0, y, 0]}
        radius={0.0018}
        smoothness={2}
      >
        <meshStandardMaterial color={color} roughness={0.45} />
      </RoundedBox>
    );
  }
  return (
    <mesh
      castShadow
      position={[0, y, tile.shape === "triangle" ? 0.003 : 0]}
      rotation={[0, Math.PI, 0]}
    >
      <cylinderGeometry
        args={
          tile.shape === "triangle"
            ? [0.03, 0.03, SHAPE_HEIGHT, 3]
            : [0.024, 0.024, SHAPE_HEIGHT, 40]
        }
      />
      <meshStandardMaterial color={color} roughness={0.45} />
    </mesh>
  );
}

/**
 * One thick maple tile with what it shows: a number printed on its top, or
 * a painted shape standing on it. Its middle is the origin.
 */
export function TileModel({ tile }: { readonly tile: Tile }) {
  return (
    <group>
      <RoundedBox
        args={[TILE.side, TILE.height, TILE.side]}
        castShadow
        radius={0.006}
        receiveShadow
        smoothness={3}
      >
        <meshStandardMaterial
          color={COUNTEREXAMPLE_COLORS.tile}
          roughness={0.55}
        />
      </RoundedBox>
      {tile.kind === "number" ? (
        <NumberFace value={tile.value} />
      ) : (
        <ShapeToken tile={tile} />
      )}
    </group>
  );
}
