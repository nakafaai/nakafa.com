import { useFrame } from "@react-three/fiber";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { DataTexture, RepeatWrapping } from "three";

/** The side of the ripple texture, in texels; it tiles without a seam. */
const TEXELS = 128;

/** How many times the ripples repeat across the sea. */
const REPEAT = 28;

/** How far the ripples drift each second, in texture widths. */
const DRIFT = 0.004;

/** The height of the swell at a texel: two octaves of tiling value noise. */
function swell(x: number, y: number) {
  return (
    valueNoise(x / 8, y / 8, TEXELS / 8) +
    0.5 * valueNoise(x / 4, y / 4, TEXELS / 4)
  );
}

/** The ripples as a bump map: the height of the swell at every texel, as a grey level, wrapped so it tiles. */
function rippleTexture() {
  const data = new Uint8Array(TEXELS * TEXELS * 4);
  Arr.forEach(Arr.range(0, TEXELS * TEXELS - 1), (texel) => {
    const level =
      (swell(texel % TEXELS, Math.floor(texel / TEXELS)) / 1.5) * 255;
    data.set([level, level, level, 255], texel * 4);
  });
  const texture = new DataTexture(data, TEXELS, TEXELS);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(REPEAT, REPEAT);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Open harbour water: a glossy sea whose ripples drift slowly while the card
 * plays, built from tiling noise, so no image is fetched.
 */
export function Sea() {
  const playing = useVisualScene((card) => card.playing, false);
  const ripples = useMemo(rippleTexture, []);

  useFrame((_, delta) => {
    if (playing) {
      ripples.offset.x += Math.min(delta, 0.1) * DRIFT;
      ripples.offset.y += Math.min(delta, 0.1) * DRIFT * 0.6;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <mesh
        position={[0, -0.05, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[160, 160]} />
        <meshPhysicalMaterial
          bumpMap={ripples}
          bumpScale={0.8}
          clearcoat={0.6}
          clearcoatRoughness={0.15}
          color={MATERIAL.water}
          roughness={0.12}
        />
      </mesh>
    </group>
  );
}
