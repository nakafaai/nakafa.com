import { RoundedBox } from "@react-three/drei";
import type { Tile } from "@repo/design-system/components/contents/mathematics/counterexample/claim";
import { TILE } from "@repo/design-system/components/contents/mathematics/counterexample/layout";
import { usePrintFont } from "@repo/design-system/components/contents/mathematics/counterexample/print";
import { COUNTEREXAMPLE_COLORS } from "@repo/design-system/lib/material/counterexample";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

/** How many pixels the printed face of a number tile has on each side. */
const FACE_PIXELS = 256;

/** How much of the tile's top the printed face covers. */
const FACE_SHARE = 0.9;

/** How thick a painted shape standing on a tile is, in metres. */
const SHAPE_HEIGHT = 0.008;

/** The minus sign a negative number is printed with, which is as wide as a digit. */
const MINUS = "−";

/**
 * Prints one number on a tile's face: dark ink, bold tabular figures, as
 * large as the face allows. The face is transparent round the figures, so
 * the maple of the tile shows through.
 */
function numberTexture(value: number, family: string) {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_PIXELS;
  canvas.height = FACE_PIXELS;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const context = canvas.getContext("2d");
  if (context === null) {
    return texture;
  }
  const figures = `${value < 0 ? MINUS : ""}${Math.abs(value)}`;
  context.font = `700 100px ${family}`;
  const width = context.measureText(figures).width;
  const size = Math.min(150, (100 * FACE_PIXELS * 0.78) / Math.max(1, width));
  context.font = `700 ${size}px ${family}`;
  context.fillStyle = COUNTEREXAMPLE_COLORS.ink;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(figures, FACE_PIXELS / 2, FACE_PIXELS / 2 + size * 0.04);
  texture.needsUpdate = true;
  return texture;
}

/** A number printed on the top of a tile. */
function NumberFace({ value }: { readonly value: number }) {
  const family = usePrintFont();
  const texture = useMemo(() => numberTexture(value, family), [family, value]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh
      position={[0, TILE.height / 2 + 0.0004, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[TILE.side * FACE_SHARE, TILE.side * FACE_SHARE]} />
      <meshStandardMaterial
        color="#ffffff"
        map={texture}
        polygonOffset
        polygonOffsetFactor={-1}
        roughness={0.7}
        transparent
      />
    </mesh>
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
