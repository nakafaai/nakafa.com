import { useThree } from "@react-three/fiber";
import { blobsOf } from "@repo/design-system/components/three/flora/block";
import { surfaceMaps } from "@repo/design-system/components/three/surface/maps";
import { useEffect, useMemo } from "react";
import {
  CapsuleGeometry,
  CylinderGeometry,
  MeshPhysicalMaterial,
  SphereGeometry,
  Vector2,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** The shapes a plant cell takes, each one unit wide, tall and deep. */
const SHAPES = {
  /** A rounded cell, as in loose tissue. */
  ball: () => new SphereGeometry(0.5, 20, 14),
  /** A brick with softened edges, as in a sheet of epidermis. */
  box: () => new RoundedBoxGeometry(1, 1, 1, 3, 0.2),
  /** A column with domed ends standing upright, as in the palisade. */
  pill: () => new CapsuleGeometry(0.5, 1, 6, 16).scale(1, 0.5, 1),
  /** A pipe lying along the depth of the block, as in a vein. */
  tube: () => new CylinderGeometry(0.5, 0.5, 1, 20).rotateX(Math.PI / 2),
};

/**
 * One tissue of a plant organ: every cell in `blobs` (the numbers
 * `growLamina` gives) drawn as an instance of one shape, tinted between
 * `deep` and `sun`, with the fine relief and moist sheen of living tissue.
 * A tissue that is `faded` steps back, so the one being studied stands out.
 *
 * @param blobs - Where every cell is and how large, as `BLOB_STRIDE` numbers each
 * @param shape - The shape of one cell
 * @param deep - The colour of the darkest cell
 * @param sun - The colour of the lightest cell
 * @param faded - Whether the tissue steps back behind the one in focus
 * @param gloss - How wet the tissue shines, from 0 to 1
 */
export function Blobs({
  blobs,
  deep,
  faded = false,
  gloss = 0.35,
  shape,
  sun,
}: {
  readonly blobs: readonly number[];
  readonly deep: string;
  readonly faded?: boolean;
  readonly gloss?: number;
  readonly shape: keyof typeof SHAPES;
  readonly sun: string;
}) {
  const built = useMemo(() => {
    const maps = surfaceMaps("tissue");
    const solid = SHAPES[shape]();
    const skin = new MeshPhysicalMaterial({
      clearcoat: gloss,
      clearcoatRoughness: 0.3,
      normalMap: maps.normal,
      normalScale: new Vector2(0.35, 0.35),
      roughness: 0.55,
    });
    return {
      mesh: blobsOf({ blobs, deep, material: skin, shape: solid, sun }),
      skin,
      solid,
    };
  }, [blobs, deep, gloss, shape, sun]);

  useEffect(
    () => () => {
      built.mesh.dispose();
      built.skin.dispose();
      built.solid.dispose();
    },
    [built]
  );

  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    built.skin.color.setScalar(faded ? 0.62 : 1);
    invalidate();
  }, [built, faded, invalidate]);

  return <primitive object={built.mesh} />;
}
