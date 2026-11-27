import { spanOf } from "@repo/design-system/components/three/matter/span";
import type { Surface } from "@repo/design-system/components/three/surface/detail";
import { surfaceMaps } from "@repo/design-system/components/three/surface/maps";
import { Array as Arr, Option } from "effect";
import type { BufferGeometry, Object3D } from "three";

/**
 * The detail textures of a material's surface, under the names a
 * physically based material reads them by: copies that share the painted
 * images, so each part lays them at its own size. A smooth material has no
 * surface and so takes none.
 */
export function layMaps(surface: Option.Option<Surface>) {
  return Option.match(surface, {
    onNone: () => [],
    onSome: (name) => {
      const shared = surfaceMaps(name);
      const finish = shared.finish.clone();
      return [
        {
          aoMap: finish,
          map: shared.tone.clone(),
          normalMap: shared.normal.clone(),
          roughnessMap: finish,
        },
      ];
    },
  });
}

/**
 * What a material runs before each draw to keep its detail at its real
 * size: the first time it meets a part, it measures how far the part runs
 * across and along its texture coordinates and lays a whole number of
 * `tile`-sized tiles over them, so a seam never shows where the part closes
 * on itself. A material with a `grain` turns its tiles a quarter on a part
 * that is longest along its texture coordinates, so the grain of a post
 * runs up it as the grain of a board runs along it. A part
 * a lab draws larger than life carries the larger detail with it. It
 * measures a part once and costs a single comparison after.
 */
export function fitMaps(
  maps: ReturnType<typeof layMaps>,
  tile: number,
  grain: boolean
) {
  const fitted: { part: Option.Option<BufferGeometry> } = {
    part: Option.none(),
  };
  return (
    _renderer: unknown,
    _scene: unknown,
    _camera: unknown,
    geometry: BufferGeometry,
    object: Object3D
  ) => {
    if (Option.contains(fitted.part, geometry)) {
      return;
    }
    fitted.part = Option.some(geometry);
    const { across, along, upright } = spanOf(geometry);
    const drawn = Math.cbrt(Math.abs(object.matrixWorld.determinant()));
    const tiles = (span: number) =>
      Math.max(1, Math.round((span * drawn) / tile));
    const turned = grain && upright;
    const [first, second] = turned ? [along, across] : [across, along];
    Arr.forEach(maps, (each) => {
      Arr.forEach([each.aoMap, each.map, each.normalMap], (map) => {
        map.rotation = turned ? Math.PI / 2 : 0;
        map.repeat.set(tiles(first), tiles(second));
      });
    });
  };
}

/** Frees the copies `layMaps` made; the painted images they share stay for the next part. */
export function freeMaps(maps: ReturnType<typeof layMaps>) {
  Arr.forEach(maps, (each) => {
    each.aoMap.dispose();
    each.map.dispose();
    each.normalMap.dispose();
  });
}
