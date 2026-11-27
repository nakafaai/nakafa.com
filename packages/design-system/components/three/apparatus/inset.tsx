import {
  PerspectiveCamera,
  RenderTexture,
  RoundedBox,
} from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  LENS,
  lensOf,
} from "@repo/design-system/components/three/apparatus/lens";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import type { Texture } from "three";

/** The light of a close view: soft all round, with a key from the upper left as on the bench. */
const LIGHT = { ambient: 0.7, key: [-0.4, 0.8, 1] as const, strength: 2.2 };

/** Lends the bench's surroundings to a close view, so its glass and metal reflect the same room. */
function Room({ environment }: { readonly environment: Texture | null }) {
  const scene = useThree((state) => state.scene);
  useLayoutEffect(() => {
    scene.environment = environment;
  }, [environment, scene]);
  return null;
}

/**
 * A close view standing at `at` and facing +z: a square picture `size`
 * metres across in a thin black frame, showing `children` magnified, seen
 * straight on from in front of `look` so that `span` metres of them fill
 * the picture top to bottom, against a `ground` such as a white card. The
 * children are drawn on their own: pass the part of the apparatus the view
 * shows, in the same place as it stands on the bench.
 *
 * @example
 * <Inset at={[0.22, 0.63, 0]} look={[0, 0.63, 0]} size={0.17} span={0.03}>
 *   <Burette holds={titrant} reading={12.3} />
 * </Inset>
 *
 * @param at - Where the middle of the picture stands
 * @param children - What the view shows
 * @param ground - The colour behind what it shows
 * @param look - The point of the children the view centres on
 * @param size - The picture's side, in metres
 * @param span - How much of the children the view shows, top to bottom, in metres
 */
export function Inset({
  at,
  children,
  ground = LABWARE_COLORS.card,
  look,
  size,
  span,
}: {
  readonly at: readonly [number, number, number];
  readonly children: ReactNode;
  readonly ground?: string;
  readonly look: readonly [number, number, number];
  readonly size: number;
  readonly span: number;
}) {
  const environment = useThree((state) => state.scene.environment);
  const lens = lensOf(look, span);
  const border = size * LENS.frame;

  return (
    <group position={at}>
      <RoundedBox
        args={[size + border * 2, size + border * 2, border]}
        castShadow
        position={[0, 0, -border / 2 - 0.0005]}
        radius={border / 3}
        smoothness={3}
      >
        <SurfaceMaterial
          color={LABWARE_COLORS.bezel}
          roughness={0.5}
          surface="plastic"
        />
      </RoundedBox>
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial>
          <RenderTexture attach="map" height={LENS.pixels} width={LENS.pixels}>
            <PerspectiveCamera
              aspect={1}
              far={lens.far}
              fov={LENS.fov}
              makeDefault
              manual
              near={lens.near}
              position={lens.camera}
            />
            <Room environment={environment} />
            <color args={[ground]} attach="background" />
            <ambientLight intensity={LIGHT.ambient} />
            <directionalLight
              intensity={LIGHT.strength}
              position={[
                look[0] + LIGHT.key[0],
                look[1] + LIGHT.key[1],
                look[2] + LIGHT.key[2],
              ]}
            />
            {children}
          </RenderTexture>
        </meshBasicMaterial>
      </mesh>
    </group>
  );
}
