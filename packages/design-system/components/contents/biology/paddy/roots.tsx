import { useFrame } from "@react-three/fiber";
import {
  hillMatrix,
  rootedHills,
} from "@repo/design-system/components/contents/biology/paddy/field";
import type { Plant } from "@repo/design-system/components/contents/biology/paddy/oxygen";
import { ROOT_DEPTH } from "@repo/design-system/components/contents/biology/paddy/oxygen";
import {
  buryInSoil,
  xrayUniforms,
} from "@repo/design-system/components/contents/biology/paddy/xray";
import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { BufferGeometry, InstancedMesh, Material } from "three";
import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The roots of one plant: how many, their radius in metres, and the seed of
 * their shapes. Rice makes many fine nodal roots about 1 mm thick (Yamauchi
 * et al. 2019, Fig. 5D), a fifth of them running out just under the surface;
 * maize fewer, thicker nodal roots.
 */
const ROOTS = {
  dryland: { count: 16, radius: 0.0009, seed: 57 },
  rice: { count: 26, radius: 0.000_55, seed: 31 },
} as const;

/** Steps along each root's path. */
const STEPS = 22;

/** Sides round each root's tube. */
const SIDES = 6;

/**
 * The paths of one plant's roots, from its base at the origin. Each leaves
 * the base outward on its own bearing, turns down with gravity, wanders a
 * little, and runs along the top of the plough pan if it reaches it; rice's
 * surface roots run out nearly level just under the mud.
 */
export function rootPaths(plant: Plant) {
  const { count, radius, seed } = ROOTS[plant];
  return Arr.map(Arr.range(0, count - 1), (root) => {
    const bearing = ((root + 0.8 * hashUnit(root, seed)) / count) * Math.PI * 2;
    const shallow = plant === "rice" && hashUnit(root, seed + 5) < 0.2;
    const dip = shallow
      ? 1.3 + 0.18 * hashUnit(root, seed + 6)
      : 0.2 + 0.95 * hashUnit(root, seed + 4) ** 0.8;
    const length = shallow
      ? 0.06 + 0.08 * hashUnit(root, seed + 1)
      : ROOT_DEPTH * (0.75 + 0.6 * hashUnit(root, seed + 1));
    const start = new Vector3(
      Math.cos(bearing) * 0.008,
      -0.004 - 0.01 * hashUnit(root, seed + 3),
      Math.sin(bearing) * 0.008
    );
    const points = Arr.scan(Arr.range(1, STEPS), start, (point, step) => {
      const s = step / STEPS;
      const tilt =
        dip * (1 - (shallow ? 0.1 : 0.45) * s) +
        (valueNoise(s * 9, root * 3.1, 64) - 0.5) * 0.3;
      const turn =
        bearing + (valueNoise(s * 7 + 5, root * 2.3, 64) - 0.5) * 0.7;
      const stride = length / STEPS;
      return new Vector3(
        point.x + Math.sin(tilt) * Math.cos(turn) * stride,
        Math.max(
          -ROOT_DEPTH,
          Math.min(point.y, -0.004) - Math.cos(tilt) * stride
        ),
        point.z + Math.sin(tilt) * Math.sin(turn) * stride
      );
    });
    return { points, radius, shallow };
  });
}

/** One root's tube from `from` to `to` of its length, `thicken` times its radius. */
function rootTube(
  points: readonly Vector3[],
  radius: number,
  from: number,
  to: number,
  thicken: number
) {
  const curve = new CatmullRomCurve3([...points]);
  const part = new CatmullRomCurve3(
    Arr.map(Arr.range(0, 12), (step) =>
      curve.getPointAt(from + ((to - from) * step) / 12)
    )
  );
  const tube = new TubeGeometry(
    part,
    Math.ceil(STEPS * 2 * (to - from)),
    radius * thicken,
    SIDES,
    false
  );
  tube.deleteAttribute("uv");
  return tube;
}

/**
 * The oxidised soil round a rice root, where the oxygen it leaks turns grey
 * ferrous iron to rusty ferric iron: a soft sheath a few millimetres thick
 * over the younger part of the root, strongest near the tip, where rice roots
 * leak most oxygen (Yamauchi et al. 2019, Fig. 5E).
 */
function haloTube(points: readonly Vector3[], radius: number) {
  const tube = rootTube(points, radius, 0.3, 1, 5);
  const rings = tube.parameters.tubularSegments;
  const tone = new Color(PADDY_COLORS.mottle);
  const count = tube.getAttribute("position").count;
  tube.setAttribute(
    "color",
    new BufferAttribute(
      new Float32Array(
        Arr.flatMap(Arr.range(0, count - 1), (index) => {
          const s = Math.floor(index / (SIDES + 1)) / rings;
          return [tone.r, tone.g, tone.b, 0.12 + 0.5 * s ** 1.4];
        })
      ),
      4
    )
  );
  return tube;
}

/** The shapes of one plant's roots: the roots, their coats, and the stains round rice roots. */
function useRootGeometry(plant: Plant) {
  const geometry = useMemo(() => {
    const paths = rootPaths(plant);
    return {
      coats: mergeGeometries(
        Arr.map(paths, ({ points, radius }) =>
          plant === "rice"
            ? rootTube(points, radius, 0, 0.42, 1.2)
            : rootTube(points, radius, 0.78, 1, 1.2)
        )
      ),
      halos: mergeGeometries(
        Arr.map(
          Arr.filter(paths, (path) => !path.shallow),
          ({ points, radius }) => haloTube(points, radius)
        )
      ),
      roots: mergeGeometries(
        Arr.map(paths, ({ points, radius }) =>
          rootTube(points, radius, 0, 1, 1)
        )
      ),
    };
  }, [plant]);
  useEffect(
    () => () => {
      geometry.roots.dispose();
      geometry.coats.dispose();
      geometry.halos.dispose();
    },
    [geometry]
  );
  return geometry;
}

/**
 * The wet, slightly translucent surface of a young root, the orange iron
 * plaque on old rice roots or the brown of dead maize tips, and the rusty
 * stain in the mud, all seen through the soil above them.
 */
function useRootMaterials(plant: Plant) {
  const materials = useMemo(() => {
    const uniforms = xrayUniforms();
    const tone =
      plant === "rice" ? PADDY_COLORS.riceRoot : PADDY_COLORS.maizeRoot;
    const coat = new MeshStandardMaterial({
      color: plant === "rice" ? PADDY_COLORS.plaque : PADDY_COLORS.deadRoot,
      depthWrite: false,
      roughness: 0.7,
      transparent: true,
    });
    const halo = new MeshStandardMaterial({
      depthWrite: false,
      roughness: 0.9,
      transparent: true,
      vertexColors: true,
    });
    const root = new MeshPhysicalMaterial({
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
      color: tone,
      emissive: tone,
      emissiveIntensity: 0.12,
      roughness: 0.45,
      sheen: 0.3,
      sheenColor: new Color(PADDY_COLORS.rootTip),
    });
    buryInSoil(coat, uniforms, "coat");
    buryInSoil(halo, uniforms, "halo");
    buryInSoil(root, uniforms, "root");
    return { coat, halo, root, uniforms };
  }, [plant]);
  useEffect(
    () => () => {
      materials.coat.dispose();
      materials.halo.dispose();
      materials.root.dispose();
    },
    [materials]
  );
  return materials;
}

/** One shape repeated at every plant over the X-ray zone, turned as its plant is, in one draw call. */
function Planted({
  geometry,
  material,
  order,
  plant,
}: {
  readonly geometry: BufferGeometry;
  readonly material: Material;
  readonly order: number;
  readonly plant: Plant;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const hills = useMemo(() => rootedHills(plant), [plant]);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const matrix = new Matrix4();
    Arr.forEach(hills, (hill, index) => {
      target.setMatrixAt(index, hillMatrix(hill, matrix));
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [hills]);
  return (
    <instancedMesh
      args={[geometry, material, hills.length]}
      ref={mesh}
      renderOrder={order}
    />
  );
}

/**
 * The roots of the plants over the X-ray zone, in the mud. Flooded, a rice
 * root wears orange iron plaque on its older part and stains the grey mud
 * round its younger part rusty where it leaks oxygen; a maize root has no air
 * to leak, and its tips die brown.
 */
export function RootSystem({
  flood,
  plant,
}: {
  readonly flood: RefObject<number>;
  readonly plant: Plant;
}) {
  const { coats, halos, roots } = useRootGeometry(plant);
  const materials = useRootMaterials(plant);

  useFrame(() => {
    materials.uniforms.uFlood.value = flood.current;
    materials.coat.opacity = (plant === "rice" ? 0.5 : 0.95) * flood.current;
    materials.coat.visible = flood.current > 0.02;
    materials.halo.opacity = flood.current;
    materials.halo.visible = plant === "rice" && flood.current > 0.02;
  });

  return (
    <group key={plant}>
      <Planted
        geometry={roots}
        material={materials.root}
        order={0}
        plant={plant}
      />
      <Planted
        geometry={coats}
        material={materials.coat}
        order={1}
        plant={plant}
      />
      <Planted
        geometry={halos}
        material={materials.halo}
        order={1}
        plant={plant}
      />
    </group>
  );
}
