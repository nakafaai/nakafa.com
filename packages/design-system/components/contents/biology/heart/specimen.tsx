import {
  ACROSS,
  AXIS,
} from "@repo/design-system/components/contents/biology/heart/anatomy";
import { coronaryVessels } from "@repo/design-system/components/contents/biology/heart/coronary";
import {
  BOUNDS,
  cavityField,
  cutDepth,
  grooveDepth,
  heartField,
  outerField,
  vesselField,
} from "@repo/design-system/components/contents/biology/heart/field";
import { useTissue } from "@repo/design-system/components/contents/biology/heart/pulse";
import { surfaceNets } from "@repo/design-system/components/contents/biology/heart/surface";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { HEART_COLORS } from "@repo/design-system/lib/material/heart";
import { Array as Arr, Record } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  TubeGeometry,
  Vector3,
} from "three";

/** The tissues the specimen is drawn in, each its own material: cut muscle and wall, the wet linings, and the outer skin. */
const CUT = 0;
const LINING = 1;
const SKIN = 2;

/** Cut muscle: matte and dark, still moist. */
const CUT_TISSUE = {
  clearcoat: 0.3,
  clearcoatRoughness: 0.5,
  roughness: 0.66,
  sheen: 0.25,
  sheenColor: HEART_COLORS.sheen,
  sheenRoughness: 0.6,
  vertexColors: true,
};

/** The endocardium and the vessels' intima: smooth and glistening. */
const LINING_TISSUE = {
  clearcoat: 0.55,
  clearcoatRoughness: 0.3,
  roughness: 0.46,
  sheen: 0.2,
  sheenColor: HEART_COLORS.sheen,
  sheenRoughness: 0.5,
  vertexColors: true,
};

/** The epicardium and the vessels' outer coat: a thin wet membrane over muscle and fat. */
const SKIN_TISSUE = {
  clearcoat: 0.5,
  clearcoatRoughness: 0.3,
  roughness: 0.5,
  sheen: 0.4,
  sheenColor: HEART_COLORS.sheen,
  sheenRoughness: 0.45,
  vertexColors: true,
};

/** The palette, as linear colours the vertex colours mix. */
const PAINT = Record.map(HEART_COLORS, (hex) => new Color(hex));

/** The colours of a great vessel's wall, cut, lining and outer coat, by tissue. */
const WALL_PAINT = {
  artery: [PAINT.arteryCut, PAINT.arteryLining, PAINT.arteryOuter],
  vein: [PAINT.veinCut, PAINT.veinLining, PAINT.veinOuter],
} as const;

/** Whether a point of the surface lies on the cut, a lining or the outer skin. */
function surfaceAt(x: number, y: number, z: number) {
  if (Math.abs(z - cutDepth(x, y)) < 0.12) {
    return CUT;
  }
  return Math.abs(cavityField(x, y, z)) < Math.abs(outerField(x, y, z))
    ? LINING
    : SKIN;
}

/** Whose wall a point of the surface belongs to: an artery's, a vein's (the shell of its wall, not the heart round it), or the heart's. */
function wallAt(x: number, y: number, z: number) {
  const arterial = vesselField(x, y, z, "artery");
  if (arterial < 0.06 && arterial > -0.45) {
    return "artery";
  }
  const venous = vesselField(x, y, z, "vein");
  return venous < 0.06 && venous > -0.42 ? "vein" : "heart";
}

/**
 * Paints the heart's own muscle: cut muscle with its fibres as faint streaks
 * across the wall, the endocardium a little mottled, and the epicardium with
 * fat filling the grooves in lobules and thinning away from them.
 */
function paintMuscle(
  tissue: number,
  x: number,
  y: number,
  z: number,
  paint: Color
) {
  const along = x * AXIS[0] + y * AXIS[1];
  const across = x * ACROSS[0] + y * ACROSS[1];
  const grain = valueNoise(along * 1.6 + 3, across * 1.6 - z, 64);
  if (tissue === CUT) {
    const fibre = valueNoise(along * 0.9, across * 7 + z * 3, 64);
    paint.copy(PAINT.muscleCut).lerp(PAINT.muscleCutDeep, 0.55 * fibre);
    return;
  }
  if (tissue === LINING) {
    paint.copy(PAINT.endocardium).multiplyScalar(0.85 + 0.25 * grain);
    return;
  }
  const lobules = valueNoise(along * 2.2, across * 2.2 + z * 1.7, 64);
  const share = Math.min(
    1,
    Math.max(0, grooveDepth(x, y, z) * 1.4 - 0.45 + 0.4 * (lobules - 0.5))
  );
  paint
    .copy(PAINT.epicardium)
    .multiplyScalar(0.9 + 0.2 * grain)
    .lerp(PAINT.fat, share);
}

/** Which tissue a point of the surface belongs to, painting its colour there. */
function tissueAt(x: number, y: number, z: number, paint: Color) {
  const tissue = surfaceAt(x, y, z);
  const wall = wallAt(x, y, z);
  if (wall === "heart") {
    paintMuscle(tissue, x, y, z, paint);
    return tissue;
  }
  paint.copy(WALL_PAINT[wall][tissue]);
  return tissue;
}

/**
 * Builds the specimen's skin from the anatomy's distance field with cells
 * `cell` wide: paints each vertex with its tissue, lays the cut's vertices on
 * the cut, lifts the linings and the
 * outer skin by a little smooth noise, as living tissue is never smooth, and
 * groups the triangles by tissue for their three materials.
 */
function buildSpecimen(cell: number) {
  const mesh = surfaceNets(heartField, BOUNDS.low, BOUNDS.high, cell);
  const count = mesh.positions.length / 3;
  const colors = new Float32Array(count * 3);
  const tissues = new Uint8Array(count);
  const paint = new Color();
  for (let index = 0; index < count; index += 1) {
    const x = mesh.positions[index * 3];
    const y = mesh.positions[index * 3 + 1];
    const z = mesh.positions[index * 3 + 2];
    tissues[index] = tissueAt(x, y, z, paint);
    colors.set([paint.r, paint.g, paint.b], index * 3);
    // The knife leaves a smooth face: set the cut's vertices on it exactly,
    // so the grid the mesh was sampled on leaves no terraces there.
    if (tissues[index] === CUT) {
      mesh.positions[index * 3 + 2] = cutDepth(x, y);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();

  // Lift the uncut surfaces along their normals by a little smooth noise.
  const normals = geometry.getAttribute("normal");
  for (let index = 0; index < count; index += 1) {
    if (tissues[index] === CUT) {
      continue;
    }
    const x = mesh.positions[index * 3];
    const y = mesh.positions[index * 3 + 1];
    const z = mesh.positions[index * 3 + 2];
    const lift =
      0.035 *
      (valueNoise(x * 2.3 + z, y * 2.3 - z * 0.7, 64) -
        0.5 +
        0.5 * (valueNoise(x * 6.1 - z, y * 6.1 + z * 1.3, 64) - 0.5));
    mesh.positions[index * 3] = x + normals.getX(index) * lift;
    mesh.positions[index * 3 + 1] = y + normals.getY(index) * lift;
    mesh.positions[index * 3 + 2] = z + normals.getZ(index) * lift;
  }
  geometry.computeVertexNormals();

  // Each triangle takes the tissue most of its corners hold.
  const groups = Arr.map([CUT, LINING, SKIN], (tissue) =>
    Arr.filter(Arr.range(0, mesh.indices.length / 3 - 1), (triangle) => {
      const a = tissues[mesh.indices[triangle * 3]];
      const b = tissues[mesh.indices[triangle * 3 + 1]];
      const c = tissues[mesh.indices[triangle * 3 + 2]];
      const major = a === b || a === c ? a : b;
      return major === tissue;
    })
  );
  const sorted = new Uint32Array(mesh.indices.length);
  let written = 0;
  Arr.forEach(groups, (triangles, tissue) => {
    geometry.addGroup(written, triangles.length * 3, tissue);
    Arr.forEach(triangles, (triangle) => {
      sorted.set(
        mesh.indices.subarray(triangle * 3, triangle * 3 + 3),
        written
      );
      written += 3;
    });
  });
  geometry.setIndex(new BufferAttribute(sorted, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The heart cut open from the front, in one closed skin: chambers, septum,
 * papillary muscles, the roots of the great vessels and the vessels
 * themselves, drawn in cut muscle, glistening lining and the shiny outer
 * skin with fat in its grooves. A phone meshes it on a coarser grid.
 */
export function Specimen() {
  const { tier } = useStage();
  const geometry = useMemo(
    () => buildSpecimen(tier === "full" ? 0.18 : 0.2),
    [tier]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  const relief = tier === "full" ? 1 : 0;
  const cut = useTissue(CUT_TISSUE, 0.12 * relief);
  const lining = useTissue(LINING_TISSUE, 0.16 * relief);
  const skin = useTissue(SKIN_TISSUE, 0.12 * relief);
  const materials = useMemo(() => [cut, lining, skin], [cut, lining, skin]);

  return <mesh geometry={geometry} material={materials} receiveShadow />;
}

/** A coronary artery: dark red under the thin shiny epicardium. */
const CORONARY_ARTERY = {
  clearcoat: 0.4,
  clearcoatRoughness: 0.35,
  color: HEART_COLORS.coronaryArtery,
  roughness: 0.55,
};

/** A coronary vein: darker and bluish red, its wall thin over the blood in it. */
const CORONARY_VEIN = {
  clearcoat: 0.4,
  clearcoatRoughness: 0.35,
  color: HEART_COLORS.coronaryVein,
  roughness: 0.5,
};

/**
 * The coronary vessels in the grooves behind the cut, each a smooth tube
 * along its course, half buried in the fat, beating with the heart.
 */
export function Coronaries() {
  const vessels = useMemo(
    () =>
      Arr.map(coronaryVessels(), (vessel) => ({
        geometry: new TubeGeometry(
          new CatmullRomCurve3(
            Arr.map(vessel.points, ([x, y, z]) => new Vector3(x, y, z))
          ),
          48,
          vessel.radius,
          8,
          false
        ),
        kind: vessel.kind,
      })),
    []
  );
  useEffect(
    () => () => Arr.forEach(vessels, ({ geometry }) => geometry.dispose()),
    [vessels]
  );
  const artery = useTissue(CORONARY_ARTERY);
  const vein = useTissue(CORONARY_VEIN);

  return (
    <group>
      {Arr.map(vessels, ({ geometry, kind }) => (
        <mesh
          geometry={geometry}
          key={geometry.uuid}
          material={kind === "artery" ? artery : vein}
        />
      ))}
    </group>
  );
}
