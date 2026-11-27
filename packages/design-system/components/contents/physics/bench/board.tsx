import { RoundedBox } from "@react-three/drei";
import { getColor } from "@repo/design-system/lib/color";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

/** How thick a circuit baseboard is, and so the height its parts stand at. */
export const BOARD_TOP = 0.07;

const GRAIN_PIXELS = 512;

/** A number between 0 and 1 that one grain line always answers. */
function grainNoise(index: number, salt: number) {
  const wave = Math.sin(index * 12.9898 + salt * 78.233) * 43_758.5453;
  return wave - Math.floor(wave);
}

/**
 * Paints quarter-sawn oak on a canvas: long wavering growth lines between its
 * pale and dark wood, and the short open pores that mark oak apart from any
 * other board. The same picture, in grey, raises the grain as a bump map.
 */
function paintOak(tone: "color" | "relief") {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = GRAIN_PIXELS;
  canvas.height = GRAIN_PIXELS;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  const relief = tone === "relief";
  ctx.fillStyle = relief ? getColor("NEUTRAL", 300) : APPARATUS_COLORS.oakLight;
  ctx.fillRect(0, 0, GRAIN_PIXELS, GRAIN_PIXELS);
  for (let band = 0; band < 14; band += 1) {
    ctx.globalAlpha = 0.08 + grainNoise(band, 11) * 0.2;
    ctx.fillStyle = relief
      ? getColor("NEUTRAL", 700)
      : APPARATUS_COLORS.oakDark;
    ctx.fillRect(
      0,
      grainNoise(band, 12) * GRAIN_PIXELS,
      GRAIN_PIXELS,
      10 + grainNoise(band, 13) * 46
    );
  }
  for (let line = 0; line < 220; line += 1) {
    const y = grainNoise(line, 1) * GRAIN_PIXELS;
    const sway = 2 + grainNoise(line, 2) * 7;
    const reach = 0.004 + grainNoise(line, 3) * 0.01;
    ctx.globalAlpha = 0.16 + grainNoise(line, 4) * 0.42;
    ctx.lineWidth = 0.6 + grainNoise(line, 5) * 2.6;
    ctx.strokeStyle = relief
      ? getColor("NEUTRAL", 700)
      : APPARATUS_COLORS.oakDark;
    ctx.beginPath();
    for (let x = 0; x <= GRAIN_PIXELS; x += 8) {
      const wobble = Math.sin(x * reach * Math.PI * 2 + line) * sway;
      if (x === 0) {
        ctx.moveTo(x, y + wobble);
      } else {
        ctx.lineTo(x, y + wobble);
      }
    }
    ctx.stroke();
  }
  ctx.fillStyle = relief ? getColor("NEUTRAL", 800) : APPARATUS_COLORS.oakPore;
  for (let pore = 0; pore < 900; pore += 1) {
    ctx.globalAlpha = 0.18 + grainNoise(pore, 6) * 0.3;
    ctx.fillRect(
      grainNoise(pore, 7) * GRAIN_PIXELS,
      grainNoise(pore, 8) * GRAIN_PIXELS,
      3 + grainNoise(pore, 9) * 12,
      1
    );
  }
  ctx.globalAlpha = 1;
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  if (!relief) {
    texture.colorSpace = SRGBColorSpace;
  }
  return texture;
}

/** The oak a board or a block is cut from: its painted grain and the relief that raises it, made once for whoever draws the wood. */
export function useOakGrain() {
  const grain = useMemo(() => paintOak("color"), []);
  const relief = useMemo(() => paintOak("relief"), []);
  useEffect(
    () => () => {
      grain?.dispose();
      relief?.dispose();
    },
    [grain, relief]
  );
  return { grain, relief };
}

const FEET = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;

/**
 * The varnished oak baseboard a school circuit is screwed to, on four rubber
 * feet, with its grain running along its length. Its parts are its children
 * and stand on its top face, which is at y = 0 for them.
 */
export function OakBoard({
  children,
  depth,
  width,
}: {
  readonly children?: ReactNode;
  readonly depth: number;
  readonly width: number;
}) {
  const { grain, relief } = useOakGrain();

  return (
    <group>
      {Arr.map(FEET, ([x, z]) => (
        <mesh
          key={`${x}:${z}`}
          position={[x * (width / 2 - 0.12), 0.012, z * (depth / 2 - 0.1)]}
        >
          <cylinderGeometry args={[0.05, 0.055, 0.024, 20]} />
          <meshStandardMaterial
            color={APPARATUS_COLORS.rubberFoot}
            roughness={0.9}
          />
        </mesh>
      ))}
      <RoundedBox
        args={[width, BOARD_TOP - 0.024, depth]}
        castShadow
        position={[0, 0.024 + (BOARD_TOP - 0.024) / 2, 0]}
        radius={0.012}
        receiveShadow
        smoothness={4}
      >
        <meshPhysicalMaterial
          bumpMap={relief}
          bumpScale={0.8}
          clearcoat={0.22}
          clearcoatRoughness={0.5}
          color={grain === null ? APPARATUS_COLORS.oakLight : getColor("WHITE")}
          map={grain}
          roughness={0.62}
        />
      </RoundedBox>
      <group position={[0, BOARD_TOP, 0]}>{children}</group>
    </group>
  );
}
