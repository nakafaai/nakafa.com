import { paintDisc } from "@repo/design-system/components/three/flora/wood";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { useEffect, useMemo } from "react";
import {
  CircleGeometry,
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
} from "three";

/** The colour of one palette entry as red, green and blue from 0 to 255, in the space an image is stored in. */
function inkOf(color: string) {
  const { b, g, r } = new Color(color).convertLinearToSRGB();
  return [r * 255, g * 255, b * 255] as const;
}

const DISC_INKS = {
  cambium: inkOf(FLORA_COLORS.cambiumWet),
  cork: inkOf(FLORA_COLORS.corkOuter),
  early: inkOf(FLORA_COLORS.woodEarly),
  heart: inkOf(FLORA_COLORS.woodHeart),
  late: inkOf(FLORA_COLORS.woodLate),
  phloem: inkOf(FLORA_COLORS.phloemInner),
  pith: inkOf(FLORA_COLORS.woodPith),
};

/** The sawn face of a stem of `rings` years as a texture, painted once per age. */
function useDiscFace(rings: number, wood: number) {
  const face = useMemo(() => {
    const size = 448;
    const texture = new DataTexture(
      paintDisc({ inks: DISC_INKS, rings, seed: 5, size, wood }),
      size,
      size
    );
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }, [rings, wood]);
  useEffect(() => () => face.dispose(), [face]);
  return face;
}

/**
 * The sawn face of a woody stem, lying flat and facing up at the origin: the
 * rings its vascular cambium laid down, one a year, pale spring wood
 * darkening into a dense band, rays running out from the pith, the wet line
 * of the cambium, the inner bark and the cork, all pressed into the face as
 * relief where the saw tore the grain.
 *
 * @param radius - How far the face reaches, to the outside of the cork
 * @param rings - How many years of wood the stem has laid down
 * @param wood - The share of the radius that is wood, inside the cambium
 */
export function Disc({
  radius,
  rings,
  wood,
}: {
  readonly radius: number;
  readonly rings: number;
  readonly wood: number;
}) {
  const face = useDiscFace(rings, wood);
  const disc = useMemo(() => new CircleGeometry(radius, 96), [radius]);
  useEffect(() => () => disc.dispose(), [disc]);

  return (
    <mesh geometry={disc} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <meshPhysicalMaterial
        bumpMap={face}
        bumpScale={0.6}
        map={face}
        roughness={0.72}
      />
    </mesh>
  );
}
