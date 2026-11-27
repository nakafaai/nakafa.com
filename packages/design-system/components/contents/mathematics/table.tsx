import {
  BOARDS,
  plankShades,
} from "@repo/design-system/components/contents/mathematics/plank";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { useHorizonFade } from "@repo/design-system/components/three/stage/terrain";
import { useEffect, useMemo } from "react";
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

/** How far the tabletop spreads from the lab's middle, in reaches. */
const SPREAD = 14;

/** Where the tabletop starts and finishes dissolving into the studio sweep, in reaches. */
const FADE = { inner: 2.4, outer: 9 } as const;

/** How long and how wide one tile of planking lies, in metres: boards 11 cm wide. */
const PLANKS = { length: 1.4, width: 0.11 * BOARDS } as const;

/** The side of the painted planking, in pixels. */
const PIXELS = 512;

/** The planking as a texture that multiplies the top's colour, and again as its relief. */
function plankTexture(across: number, along: number) {
  const shades = plankShades(PIXELS, PIXELS);
  const data = new Uint8Array(PIXELS * PIXELS * 4);
  shades.forEach((shade, index) => {
    const value = Math.round(shade * 255);
    data.set([value, value, value, 255], index * 4);
  });
  const texture = new DataTexture(data, PIXELS, PIXELS);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.colorSpace = SRGBColorSpace;
  texture.repeat.set(along, across);
  texture.needsUpdate = true;
  return texture;
}

/**
 * The tabletop a tabletop lab stands on: planked hardwood under a satin
 * finish, at the stage's floor. It takes the key light's shadows and
 * dissolves into the studio's seamless backdrop far from the lab, so no slab
 * edge or empty void ever shows behind the objects. The camera leaves it out
 * when it frames the lab.
 *
 * @param color - The wood's own colour
 */
export function StudioTable({ color }: { readonly color: string }) {
  const { floor = 0, reach } = useStage();
  const radius = SPREAD * reach;
  const planks = useMemo(
    () =>
      plankTexture((2 * radius) / PLANKS.width, (2 * radius) / PLANKS.length),
    [radius]
  );
  const horizonFade = useHorizonFade(FADE.inner * reach, FADE.outer * reach);

  useEffect(() => () => planks.dispose(), [planks]);

  return (
    <CameraBounds exclude>
      <mesh
        position={[0, floor - 0.0004, 0]}
        receiveShadow
        renderOrder={-10}
        rotation={[-Math.PI / 2, 0, 0]}
        userData={{ treatAsOpaque: true }}
      >
        <circleGeometry args={[radius, 96]} />
        <meshPhysicalMaterial
          bumpMap={planks}
          bumpScale={0.004}
          clearcoat={0.35}
          clearcoatRoughness={0.35}
          color={color}
          depthWrite
          map={planks}
          ref={horizonFade}
          roughness={0.48}
          transparent
        />
      </mesh>
    </CameraBounds>
  );
}
